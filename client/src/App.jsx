import React, { useState, useEffect } from "react";
import "./App.css";

// ★修正2: localStorage から初期値を読み込むヘルパー関数
const getInitialResults = () => {
  const saved = localStorage.getItem("processedFilesList");
  // JSON文字列をパースして返す。データがない場合は空の配列を返す。
  return saved ? JSON.parse(saved) : [];
};

function App() {
  // 1. Stateの変更：単一ファイル -> ファイル配列と結果リスト
  const [files, setFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  //幅と高さの管理
  const [targetWidth, setTargetWidth] = useState(800);
  const [targetHeight, setTargetHeight] = useState(800);

  // 初期値を localStorage から読み込む
  const [processedFilesList, setProcessedFilesList] =
    useState(getInitialResults);

  const MAX_FILES = 10;

  // ★修正4: 処理結果リストが変更されるたびに localStorage に保存する
  useEffect(() => {
    // processedFilesList の内容を JSON 文字列にして保存
    localStorage.setItem(
      "processedFilesList",
      JSON.stringify(processedFilesList)
    );
  }, [processedFilesList]);

  // ドラッグオーバー防止
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // 2. ファイル選択およびドロップイベントの共通処理
  const processFiles = (fileList) => {
    const imageFiles = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length > MAX_FILES) {
      setUploadStatus(
        `一度にアップロードできる枚数は${imageFiles.length}までです。`
      );
      setFiles([]);
      return;
    }

    if (imageFiles.length > 0) {
      setFiles(imageFiles);
      setUploadStatus(`${imageFiles.length}個のファイルが選択されました`);
    } else {
      setUploadStatus("画像ファイルを選択してください");
    }
    setProcessedFilesList([]); // 新しいファイルが選択されたら結果をリセット
  };
  // ファイル選択イベント
  const handleFileChange = (e) => {
    processFiles(e.target.files);
  };

  // ドラッグ＆ドロップイベント
  const handleDrop = (e) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  // 3. アップロードイベント (複数ファイル対応)
  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadStatus("ファイルを選択してください。");
      return;
    }
    setIsLoading(true);
    setUploadStatus(`ファイル${files.length}個をアップロード中...`);
    setProcessedFilesList([]);

    // FormDataの作成
    const formData = new FormData();

    // ★修正: 複数のファイルを 'imageFiles' というキーでFormDataに追加
    files.forEach((file) => {
      formData.append("imageFiles", file);
    });
    // 入力値を FormData に追加
    formData.append("targetWidth", targetWidth);
    formData.append("targetHeight", targetHeight);

    try {
      // サーバーへPOSTリクエスト
      const response = await fetch("http://13.230.235.63:5000/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadStatus(`処理成功${data.message}`);
        // ★修正: 結果リストをStateに保存
        setProcessedFilesList(data.fileInfoList);
      } else {
        setUploadStatus(`処理失敗${data.message}`);
        // 失敗時も結果リストを受け取る
        setProcessedFilesList(data.fileInfoList || []);
      }
    } catch (error) {
      console.error("通信エラー:", error);
      setUploadStatus(
        `通信エラー発生、サーバーが起動してるか確認してください。`
      );
    } finally {
      setIsLoading(false);
    }
  };

// ★修正5: 一括ダウンロードイベント
const handleDownloadAll=async()=>{
  if(processedFilesList.length===0) return;

  setIsLoading(true);
  setUploadStatus(`全てのファイルをZIP圧縮してダウンロード準備中...`);

  // 成功したファイルのファイル名（サーバーのprocessedフォルダ内の名前）のみを抽出
  const successfulFilenames=processedFilesList.filter(f=>f.success).map(f=>f.filename);// filenameはサーバーのファイル名
  if(successfulFilenames.length===0){
    setUploadStatus("ダウンロードできるファイルがありません。");
     setIsLoading(false);
     return;
  }
  try{
    // サーバーへPOSTリクエスト (ファイル名のリストをJSONで送信)
    const response=await fetch("http://13.230.235.63:5000/api/download/all",{
      method:"POST",
      headers:{
        'Content-Type':'application/json',// JSONとして送信
      },
      body:JSON.stringify({filenames:successfulFilenames}),
    });
    if(response.ok){
      // サーバーが返したBlob (バイナリデータ) を取得
      const blob=await response.blob();
      const url=window.URL.createObjectURL(blob);
      // ダウンロード用の a タグを作成・クリック
      const a=document.createElement('a');
      a.href=url;
      a.download=`resized_images_${Date.now()}.zip`;// ファイル名を指定
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setUploadStatus(`ZIPファイルのダウンロードが開始されました (${successfulFilenames.length}件)。`);
    }else{
      // サーバー側でエラーが発生した場合 (例: 500 Internal Server Error)
      const errorText=await response.text();
setUploadStatus(`一括ダウンロード失敗: サーバーエラーが発生しました (${response.status} ${errorText.substring(0, 100)}...)`);
    }
  }catch(error){
    console.error("通信エラー:", error);
    setUploadStatus(`通信エラー発生、サーバーが起動してるか確認してください。`);
  }finally{
setIsLoading(false);
  }
};

  // 4. UIのレンダリング (JSXを return)
  return (
    <div className="app-container">
      <h1>画像リサイズツール（βテスト版）</h1>
      <p>
        複数の画像をドラッグ＆ドロップまたは選択して、一括リサイズを行います。
        <br />
        縦横比を維持したままリサイズするため、余白は白で埋められます
      </p>

      {/* 入力フォーム */}
      <div>
        幅:{" "}
        <input
          type="number"
          value={targetWidth}
          onChange={(e) => setTargetWidth(Number(e.target.value))}
        />{" "}
        px 高さ:{" "}
        <input
          type="number"
          value={targetHeight}
          onChange={(e) => setTargetHeight(Number(e.target.value))}
        />{" "}
        px
      </div>
      <br />

      {/* ドラッグ＆ドロップエリア */}
      <div
        className="drop-zone"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        ここに画像をドラッグ＆ドロップ<br />
        <span style={{ margin: "0 10px" }}>または</span>
        {/* ファイル選択入力 */}
        <input
          type="file"
          accept="image/*"
          multiple // ★修正: 複数ファイル選択を可能にする
          onChange={handleFileChange}
          style={{ display: "inline" }}
        />
      </div>
      <br />

      {/* アップロードボタン */}
      <button onClick={handleUpload} disabled={isLoading || files.length === 0}>
        {isLoading
          ? "処理中..."
          : `${files.length}個のファイルをサーバーへアップロード`}
      </button>

      {/* ステータス表示 */}
      <p style={{ marginTop: "20px", fontWeight: "bold" }}>
        ステータス: {uploadStatus || "待機中"}
      </p>
      {/* X,instagramへのリンク、エラー報告 */}
      <p
        style={{
          marginTop: "20px",
          fontWeight: "bold",
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
        }}
      >
        エラーが発生した場合や、ご意見・ご要望はお手数ですが下記SNSまでお願いいたします。
        <br />
        <a href="#">Xアイコン+アカウント名（仮）</a>
        <br />
        <a href="#">instagramアイコン+アカウント名（仮）</a>
      </p>
      {/* ★修正6: ダウンロードボタンの追加  */}
      {/* 処理結果リストの表示  */}
      {processedFilesList.length > 0 && (
        <div
          style={{
            marginTop: "30px",
            borderTop: "1px solid #ccc",
            paddingTop: "20px",
          }}
        >
          <h3>
            処理結果一覧 ({processedFilesList.length}件)
            <br />
            *画像を保存してから次のアップロード作業に移ってください。
          </h3>
{/* ★修正6: 一括ダウンロードボタン */}
<button onClick={handleDownloadAll} disabled={isLoading} style={{marginBottom:'15px'}}>
  ✅ 成功したファイルをまとめてダウンロード ({processedFilesList.filter(f => f.success).length}件)
</button>
<p style={{ fontWeight: 'bold' }}>処理結果一覧 ({processedFilesList.length}件)</p>
          <ul>
            {processedFilesList.map((fileInfo, index) => (
              <li
                key={index}
                style={{
                  color: fileInfo.success ? "green" : "red",
                  margin: "10px 0",
                }}
              >
                **{fileInfo.originalname || fileInfo.filename}**
                {fileInfo.success ? (
                  <>
                    (成功) -
                    <a
                      href={`http://13.230.235.63:5000/download/${fileInfo.filename}`}
                      download
                      target="_blank"
                    >
                      ダウンロード
                    </a>
                  </>
                ) : (
                  ` (失敗: ${fileInfo.error || "不明なエラー"})`
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* 利用規約とプライバシーポリシー いずれ別のページに移動 */}
      <h3 style={{
          marginTop: "20px",
          fontWeight: "bold",
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
        }}>プライバシーポリシー</h3>
      <dl>
        <dt>収集する情報</dt>
        <dd>当サービスは、画像処理のため、ユーザーがアップロードした画像ファイル（処理後一定期間後に自動削除されます）及び、サービスの利用状況を把握するため、IPアドレス、Cookie情報を収集します。</dd><br />
        <dt>情報の利用目的</dt>
        <dd>サービスの提供、改善、問い合わせ対応、および広告配信（Google AdSense等）に利用します。</dd><br />
        <dt>Google Analytics</dt>
        <dd>当サービスでは、利用状況分析のためにGoogle Analyticsを利用しています。データ収集方法についてはGoogle社のプライバシーポリシーをご確認ください。</dd><br />
        <dt>広告について</dt>
        <dd>当サービスは、Google AdSenseなどの第三者配信の広告サービスを利用しています。広告配信事業者は、Cookieを使用することがあります。</dd><br />
        <dt>免責事項</dt>
        <dd>当サービスを利用したことによるいかなる損害についても、当サービスは一切の責任を負いません。アップロードされた画像に含まれる著作権、肖像権等の問題について、当サービスは一切関与しません。</dd><br />

      </dl>

            <h3 style={{
          marginTop: "20px",
          fontWeight: "bold",
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
        }}>利用規約</h3>
          <dl>
            <dt>利用資格</dt>
            <dd>ウェブサービスへのアクセスと利用は、本規約に同意した方に限られます。</dd><br />
            <dt>アップロード禁止事項</dt>
            <dd>* 法令に違反するもの。 * 第三者の著作権、肖像権その他の権利を侵害するもの。 * 公序良俗に反するもの。</dd><br />
            <dt>著作権</dt>
            <dd>アップロードされた画像の著作権は、利用者に帰属します。ただし、当サービスの機能提供に必要な範囲で、サーバー上での一時的な複製・変換を許諾するものとします。</dd><br />
            <dt>データの削除</dt>
            <dd>アップロードされた画像ファイルは、処理完了後、またはサーバーの負荷状況に応じて予告なく自動的に削除されます。データ保持の保証はいたしません。</dd><br />
          </dl>
    </div>
  );
}

export default App;
