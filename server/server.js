// server.js (最終修正版: 複数ファイル対応とレスポンス修正)

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs").promises; // Promise版 fs
const fsSync = require("fs"); // 同期版 fs
const sharp = require("sharp");
const path = require("path"); // pathモジュールを追加
// 必要なモジュールを追加
const archiver = require("archiver");
const { error } = require("console");

const app = express();
const port = 5000;

// Multerの設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const correctOriginalname = Buffer.from(
      file.originalname,
      "latin1"
    ).toString("utf8");
    // Multerは一時的にユニークなファイル名を作成
    cb(null, Date.now() + "-" + correctOriginalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    files: 10,
  },
});

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use("/download", express.static("processed"));

// APIエンドポイントの定義
app.post("/api/upload", upload.array("imageFiles"), async (req, res) => {
  // req.files (配列) をチェック
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "ファイルがアップロードされていません。",
    });
  }

  const { targetWidth, targetHeight } = req.body;
  const width = parseInt(targetWidth) || 800;
  const height = parseInt(targetHeight) || 800;

  const processedFiles = [];

  // ----------------------------------------------------
  // ★ 複数ファイル処理のループ
  // ----------------------------------------------------
  for (const file of req.files) {
    // ★修正1: Multerが提供する file.originalname をデコードする
    const originalnameDecoded = Buffer.from(
      file.originalname,
      "latin1"
    ).toString("utf8");

    const inputFile = file.path;
    const outputFolder = "processed/";

    // 出力ファイル名を生成
    const originalNameWithoutExt = path.parse(originalnameDecoded).name;
    const outputFilename = `${originalNameWithoutExt}-${Date.now()}.jpeg`;
    const outputPath = outputFolder + outputFilename;

    try {
      // 2. Sharpによる画像処理 (縦横比維持・余白追加)
      await sharp(inputFile)
        .resize(width, height, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toFormat("jpeg", { quality: 90 })
        .toFile(outputPath);

      // 3. 元の一時ファイルを非同期で削除
      try {
        await fs.unlink(inputFile);
      } catch (unlinkError) {
        if (unlinkError.code === "EPERM") {
          console.warn(`⚠️ 削除エラー (EPERM): ${inputFile}。`);
        } else {
          console.error(`❌ その他の削除エラー:`, unlinkError);
        }
      }

      // 成功したファイル情報を配列に追加
      processedFiles.push({
        filename: outputFilename,
        originalname: originalnameDecoded,
        success: true,
      });
    } catch (error) {
      // 処理に失敗した場合
      console.error(
        `❌ ファイル ${originalnameDecoded} の処理中に致命的なエラー:`,
        error
      );

      // 失敗情報を配列に入れる
      processedFiles.push({
        filename: originalnameDecoded,
        error: error.message,
        success: false,
      });

      // 失敗したファイルも一時ファイルを削除（同期処理）
      if (fsSync.existsSync(inputFile)) {
        try {
          fsSync.unlinkSync(inputFile);
        } catch (e) {
          console.error(`❌ 致命的エラー発生時の削除も失敗: ${inputFile}`);
        }
      }
    }
  } // ----------------------------------------------------
  // ★ 複数ファイル処理のループ終了
  // ----------------------------------------------------

  // ★修正3: ループ完了後、一度だけ集計結果をレスポンスとして返す
  const successfulCount = processedFiles.filter((f) => f.success).length;
  const errorCount = processedFiles.filter((f) => !f.success).length;

  console.log(
    `--- ファイル処理完了。成功数: ${successfulCount} / 全体: ${req.files.length} ---`
  );

  res.json({
    success: successfulCount > 0, // 1つでも成功していれば成功とする
    message: `処理が完了しました。成功: ${successfulCount}件、失敗: ${errorCount}件。`,
    fileInfoList: processedFiles, // 処理結果のリストを返す
  });
});

// ----------------------------------------------------
// ★ 新しいAPIエンドポイント: 一括ダウンロード
// ----------------------------------------------------
app.post("/api/download/all", express.json(), async (req, res) => {
  // 1. クライアントからファイル名のリストを受け取る
  const filenames = req.body.filenames;

  if (!filenames || filenames.length === 0) {
    return res
      .status(400)
      .json({
        success: false,
        message: "ダウンロードするファイルが指定されていません。",
      });
  }
  // 2. レスポンスヘッダーの設定 (ZIPファイルとして認識させる)
  const zipName = `resized_images_${Date.now()}.zip`;
  res.attachment(zipName);
  res.setHeader("Content-Type", "application/zip");

  // 3. archiver の設定
  const archive = archiver("zip", { zlib: { level: 9 } });
  // 4. エラー処理と終了処理
  archive.on("error",(err)=>{
    console.error("Archiver Error:",err);
    res.status(500).send({success:false,error:err.message});
  });
  // レスポンスストリームにパイプ
  archive.pipe(res);
  // 5. ファイルをアーカイブに追加
  for(const filename of filenames){
    const filePath=path.join(__dirname,"processed",filename);
    // 存在するファイルのみ追加（セキュリティ上、ファイル名が不正でないかも確認）
    if(fsSync.existsSync(filePath)){
      let nameInZip=filename;
      // 【暫定対応】元のファイル名をクライアント側でStateに保持させているため、クライアントから渡されたファイル名（URLでダウンロードしているもの）をそのままZIP内のファイル名として使います。
      archive.file(filePath,{name:nameInZip});
    }
  }
  // 6. アーカイブ処理を終了し、レスポンスを送信
  archive.finalize();
});

// サーバー起動処理
app.listen(port, () => {
  console.log(`サーバーは http://localhost:${port} で稼働中です`);
});
