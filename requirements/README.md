# IE requirements｜家づくり要件定義ツール

家づくりの希望を選択し、Must／Should分類と一対比較を通して要件定義書を作成するWebアプリです。

## GitHub Pagesで公開する

```bash
npm install
npm run build:pages
```

実行すると、GitHub Pages用の `index.html`、`assets/`、`.nojekyll` が生成されます。生成物も含めてGitへコミットしてください。

GitHubリポジトリの **Settings → Pages** で、`main` ブランチの `/ (root)` を公開元に選択します。このアプリがリポジトリ内の `requirements` フォルダにある場合、公開URLは次の形式です。

```text
https://<ユーザー名>.github.io/<リポジトリ名>/requirements/
```

すべてのパスは相対指定のため、プロジェクトサイトのサブディレクトリでも動作します。サーバー処理や環境変数は不要です。

## ローカル開発

```bash
npm run dev
```

通常の静的HTML版を確認する場合は `npm run build:pages` の後、`requirements/index.html` をブラウザで開くか、任意の静的HTTPサーバーで配信してください。
