import React, { useState, useEffect } from "react";

// localStorage から初期値を読み込むヘルパー関数
const getInitialResults = () => {
  const saved = localStorage.getItem("processedFilesList");
  return saved ? JSON.parse(saved) : [];
};

function App() {
  const [files, setFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [targetWidth, setTargetWidth] = useState(800);
  const [targetHeight, setTargetHeight] = useState(800);
  const [processedFilesList, setProcessedFilesList] = useState(getInitialResults);
  // ドラッグ状態を管理するステート
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILES = 10;

  // 処理結果リストが変更されるたびに localStorage に保存する
  useEffect(() => {
    localStorage.setItem(
      "processedFilesList",
      JSON.stringify(processedFilesList)
    );
  }, [processedFilesList]);

  // ドラッグオーバー、ドラッグエンター、ドラッグリーブの処理
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    // 関連要素から離脱した場合のみ状態を更新
    if (e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    setIsDragging(false);
  };
  
  // ファイル選択およびドロップイベントの共通処理
  const processFiles = (fileList) => {
    const imageFiles = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length > MAX_FILES) {
      setUploadStatus(
        `一度にアップロードできる枚数は${MAX_FILES}までです。`
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
    setIsDragging(false); // ドロップ完了
    processFiles(e.dataTransfer.files);
  };

  // アップロードイベント (複数ファイル対応)
  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadStatus("ファイルを選択してください。");
      return;
    }
    setIsLoading(true);
    setUploadStatus(`ファイル${files.length}個をアップロード中...`);
    setProcessedFilesList([]);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("imageFiles", file);
    });
    formData.append("targetWidth", targetWidth);
    formData.append("targetHeight", targetHeight);

    try {
      // ★注意：IPアドレス直書き。ドメイン取得後に修正が必要です。
      const response = await fetch("https://aim-automata-image-modifier.com/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadStatus(`処理成功: ${data.message}`);
        setProcessedFilesList(data.fileInfoList);
      } else {
        setUploadStatus(`処理失敗: ${data.message}`);
        setProcessedFilesList(data.fileInfoList || []);
      }
    } catch (error) {
      console.error("通信エラー:", error);
      setUploadStatus(
        `通信エラー発生。サーバーが起動しているか確認してください。`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 一括ダウンロードイベント
  const handleDownloadAll=async()=>{
    if(processedFilesList.length===0) return;

    setIsLoading(true);
    setUploadStatus(`全てのファイルをZIP圧縮してダウンロード準備中...`);

    const successfulFilenames=processedFilesList.filter(f=>f.success).map(f=>f.filename);
    if(successfulFilenames.length===0){
      setUploadStatus("ダウンロードできるファイルがありません。");
        setIsLoading(false);
        return;
    }
    try{
      // ★注意：IPアドレス直書き。ドメイン取得後に修正が必要です。
      const response=await fetch("https://aim-automata-image-modifier.com/api/download/all",{
        method:"POST",
        headers:{
          'Content-Type':'application/json',
        },
        body:JSON.stringify({filenames:successfulFilenames}),
      });
      if(response.ok){
        const blob=await response.blob();
        const url=window.URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=`resized_images_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setUploadStatus(`ZIPファイルのダウンロードが開始されました (${successfulFilenames.length}件)。`);
      }else{
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


  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl p-6 sm:p-10 space-y-8">
        
        {/* ヘッダー */}
        <header className="border-b pb-4">
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
            AI❤m-アイム- automata image modifier
          </h1>
          <p className="mt-2 text-gray-600">
            複数の画像をドラッグ＆ドロップまたは選択して、一括リサイズを行います。
          </p>
        </header>

        {/* 1. リサイズ設定エリア */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">リサイズサイズ設定 (px)</h2>
          <div className="flex flex-wrap items-center space-y-2 sm:space-y-0 sm:space-x-6 text-gray-700">
            <label className="flex items-center space-x-2">
              <span>幅:</span>
              <input
                type="number"
                value={targetWidth}
                onChange={(e) => setTargetWidth(Number(e.target.value))}
                className="w-24 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              />
            </label>
            <label className="flex items-center space-x-2">
              <span>高さ:</span>
              <input
                type="number"
                value={targetHeight}
                onChange={(e) => setTargetHeight(Number(e.target.value))}
                className="w-24 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              />
            </label>
            <span className="text-sm text-gray-500 italic">縦横比を維持し、余白は白で埋めます。</span>
          </div>
        </div>

        {/* 2. ドロップゾーン＆アップロードボタン */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">ファイルアップロード（一度に10枚まで）</h2>
          
          <div
            className={`
              w-full h-40 flex flex-col items-center justify-center p-6 
              border-4 border-dashed rounded-lg cursor-pointer transition-all duration-300
              ${isDragging
                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-lg scale-[1.02]"
                : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-gray-100"
              }
            `}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-lg font-medium">
              {isDragging ? "ここにドロップ！" : "ここに画像をドラッグ＆ドロップ"}
            </div>
            <span className="my-2 text-gray-500">または</span>
            <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full cursor-pointer transition duration-150 shadow-md">
              ファイルを選択
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={isLoading || files.length === 0}
            className={`
              w-full py-3 rounded-lg text-white font-semibold transition duration-150 shadow-md
              ${isLoading || files.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 active:bg-green-800"
              }
            `}
          >
            {isLoading
              ? "処理中..."
              : `${files.length}個のファイルをサーバーへアップロード`}
          </button>
          
          <p className="mt-2 text-center font-bold text-gray-600">
            ステータス: {uploadStatus || "待機中"}
          </p>
        </div>

        {/* 3. 処理結果一覧 */}
        {processedFilesList.length > 0 && (
          <div className="border-t pt-6 mt-6 space-y-4">
            <h3 className="text-xl font-semibold text-gray-700">処理結果一覧 ({processedFilesList.length}件)</h3>
            
            {/* 一括ダウンロードボタン */}
            <button 
              onClick={handleDownloadAll} 
              disabled={isLoading || processedFilesList.filter(f => f.success).length === 0} 
              className={`
                py-2 px-4 rounded-lg font-bold transition duration-150 shadow-md
                ${isLoading || processedFilesList.filter(f => f.success).length === 0
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }
              `}
            >
              <span role="img" aria-label="download">⬇️</span> 成功ファイルをまとめてZIPダウンロード ({processedFilesList.filter(f => f.success).length}件)
            </button>
            
            <ul className="space-y-3">
              {processedFilesList.map((fileInfo, index) => (
                <li
                  key={index}
                  className={`p-3 rounded-md shadow-sm ${fileInfo.success ? "bg-green-50" : "bg-red-50"}`}
                >
                  <strong className={fileInfo.success ? "text-green-700" : "text-red-700"}>
                    {fileInfo.originalname || fileInfo.filename}
                  </strong>
                  {fileInfo.success ? (
                    <>
                      <span className="text-green-600 ml-3">(成功)</span> -
                      <a
                        // ★注意：IPアドレス直書き。ドメイン取得後に修正が必要です。
                        href={`https://aim-automata-image-modifier.com/download/${fileInfo.filename}`}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 ml-2 underline"
                      >
                        個別ダウンロード
                      </a>
                    </>
                  ) : (
                    <span className="text-red-600 ml-3">
                      (失敗: {fileInfo.error || "不明なエラー"})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 4. サポート＆SNS */}
        <div className="border-t pt-6 mt-6 space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">サポートとエラー報告</h3>
          <p className="text-gray-600">
            エラーが発生した場合や、ご意見・ご要望はお手数ですが下記SNSまでご連絡ください。
          </p>
          <div className="flex space-x-6">
            
            {/* Xアイコン (仮アカウント名) */}
            <a href="https://twitter.com/YourXAccount" target="_blank" rel="noopener noreferrer" 
               className="flex items-center text-gray-600 hover:text-blue-500 transition duration-150">
              {/* X アイコンの SVG */}
              <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                <path d="M18.901 1.153C17.072 1.146 15.312 1.83 14.07 3.076L11.235 6.452L8.4 3.076C7.158 1.83 5.398 1.146 3.569 1.153C-0.038 1.153 -1.189 7.037 2.658 9.944L5.801 12.871L2.658 15.798C-1.189 18.705 0.038 24.589 3.569 24.589C5.398 24.589 7.158 23.905 8.4 22.662L11.235 19.286L14.07 22.662C15.312 23.905 17.072 24.589 18.901 24.589C22.498 24.589 23.649 18.705 19.802 15.798L16.659 12.871L19.802 9.944C23.649 7.037 22.498 1.153 18.901 1.153Z" clipRule="evenodd" fillRule="evenodd" />
              </svg>
              <span className="ml-2 font-medium">@YourXAccount (仮)</span>
            </a>

            {/* Instagramアイコン (仮アカウント名) */}
            <a href="https://instagram.com/YourInstaAccount" target="_blank" rel="noopener noreferrer"
               className="flex items-center text-gray-600 hover:text-pink-500 transition duration-150">
              {/* Instagram アイコンの SVG (簡易版) */}
              <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.747.01 3.7.046 1.05.035 1.84.195 2.45.413 1.056.402 1.84 1.194 2.24 2.24.217.61.378 1.4.413 2.45.036.95.046 1.27.046 3.715s-.01 2.75-.046 3.7c-.035 1.05-.195 1.84-.413 2.45-.402 1.056-1.194 1.84-2.24 2.24-.61.217-1.4.378-2.45-.413-.95-.036-1.27-.046-3.715-.046s-2.75.01-3.7.046c-1.05.035-1.84.195-2.45.413-1.056.402-1.194 1.84-2.24-2.24-.217-.61-.378-1.4-.413-2.45-.036-.95-.046-1.27-.046-3.715s.01-2.75.046-3.7c.035-1.05.195-1.84.413-2.45.402-1.056 1.194-1.84 2.24-2.24.61-.217 1.4-.378 2.45-.413.95-.036 1.27-.046 3.715-.046zm0-2c-2.718 0-3.056.014-4.12.054a4.42 4.42 0 00-2.657.925 4.417 4.417 0 00-.925 2.657c-.04 1.064-.054 1.392-.054 4.12s.014 3.055.054 4.12a4.42 4.42 0 00.925 2.657 4.417 4.417 0 002.657.925c1.064.04 1.392.054 4.12.054s3.055-.014 4.12-.054a4.42 4.42 0 002.657-.925 4.417 4.417 0 00.925-2.657c.04-1.064.054-1.392.054-4.12s-.014-3.055-.054-4.12a4.42 4.42 0 00-.925-2.657 4.417 4.417 0 00-2.657-.925c-1.064-.04-1.392-.054-4.12-.054zm0 6.871a3.492 3.492 0 100-6.984 3.492 3.492 0 000 6.984zm0-8.984a.972.972 0 100-1.944.972.972 0 000 1.944z" clipRule="evenodd" />
              </svg>
              <span className="ml-2 font-medium">@YourInstaAccount (仮)</span>
            </a>
          </div>
        </div>

        {/* 5. プライバシー/利用規約 */}
        <div className="border-t pt-6 mt-6 text-sm text-gray-600 space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">利用規約・プライバシーポリシー</h3>
          
          <details className="border rounded-lg p-4 bg-gray-50">
            <summary className="font-bold cursor-pointer text-gray-800">プライバシーポリシー</summary>
            <dl className="mt-2 space-y-2 pl-4">
              <dt className="font-medium">収集する情報</dt>
              <dd>当サービスは、画像ファイル（処理後自動削除）及び、サービスの利用状況を把握するため、IPアドレス、Cookie情報を収集します。</dd>
              <dt className="font-medium">情報の利用目的</dt>
              <dd>サービスの提供、改善、問い合わせ対応、および広告配信（Google AdSense等）に利用します。</dd>
              <dt className="font-medium">Google Analytics</dt>
              <dd>当サービスでは、利用状況分析のためにGoogle Analyticsを利用しています。データ収集方法についてはGoogle社のプライバシーポリシーをご確認ください。</dd>
              <dt className="font-medium">免責事項</dt>
              <dd>当サービスを利用したことによるいかなる損害についても、当サービスは一切の責任を負いません。アップロードされた画像に含まれる著作権、肖像権等の問題について、当サービスは一切関与しません。</dd>
            </dl>
          </details>

          <details className="border rounded-lg p-4 bg-gray-50">
            <summary className="font-bold cursor-pointer text-gray-800">利用規約</summary>
            <dl className="mt-2 space-y-2 pl-4">
              <dt className="font-medium">アップロード禁止事項</dt>
              <dd>* 法令に違反するもの。 * 第三者の著作権、肖像権その他の権利を侵害するもの。 * 公序良俗に反するもの。</dd>
              <dt className="font-medium">著作権</dt>
              <dd>アップロードされた画像の著作権は、利用者に帰属します。当サービスの機能提供に必要な範囲での一時的な複製・変換を許諾するものとします。</dd>
              <dt className="font-medium">データの削除</dt>
              <dd>アップロードされた画像ファイルは、処理完了後、またはサーバーの負荷状況に応じて予告なく自動的に削除されます。データ保持の保証はいたしません。</dd>
            </dl>
          </details>
        </div>
      </div>
    </div>
  );
}

export default App;