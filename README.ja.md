# Claude Code Proxy Pro

[简体中文](README.zh-CN.md) | [English](README.md) | 日本語 | [繁體中文](README.zh-TW.md)

Claude Code Proxy Pro は、開発者が Claude API プロキシを簡単に設定・管理できる効率的な Claude Code プロキシツールです。複数のモデルと設定プロファイルをサポートしています。

## 機能

- 🚀 **ワンクリック起動**：シンプルなインターフェースでプロキシサービスを素早く起動
- 🔧 **マルチプロファイル管理**：最大10個の設定プロファイルをサポート、簡単に切り替え
- 🌐 **多言語サポート**：簡体字中国語、英語、日本語、繁体字中国語をサポート
- 🎨 **モダンなUI**：美しいダークテーマインターフェース、スムーズな操作感
- 🔒 **安全で信頼性の高い**：機密情報の暗号化保存、包括的なエラー処理
- 🖥️ **クロスプラットフォーム**：Windows、macOS、Linuxをサポート
- 🔄 **自動更新**：組み込みの自動更新メカニズム
- 📊 **環境検出**：必要なコンポーネントを自動的にチェックしてインストール

## システム要件

- Node.js 16.0以上
- Git
- オペレーティングシステム：Windows 10+、macOS 10.15+、またはLinux

## インストール

### ビルド済みバージョンのダウンロード

[Releases](https://github.com/miounet11/claude-code-proxy-pro/releases) ページにアクセスして、お使いのプラットフォーム用のインストーラーをダウンロードしてください：

- Windows：`.exe` インストーラー
- macOS：`.dmg` インストーラー
- Linux：`.AppImage` または `.deb` パッケージ

### ソースからビルド

```bash
# リポジトリをクローン
git clone https://github.com/miounet11/claude-code-proxy-pro.git
cd claude-code-proxy-pro

# 依存関係をインストール
npm install

# 開発バージョンを起動
npm start

# プラットフォーム用にビルド
npm run build
```

## 使用方法

1. **初回起動**
   - アプリケーションが自動的に環境をチェックします
   - 必要に応じて不足しているコンポーネントをインストールします

2. **プロキシの設定**
   - 「プロファイル追加」をクリックして新しい設定を作成
   - APIアドレス、APIキーを入力し、モデルを選択
   - 設定を保存

3. **プロキシの開始**
   - 設定プロファイルを選択
   - 「プロキシを開始」ボタンをクリック
   - プロキシはデフォルトポート8082で実行されます

4. **Claude Codeの起動**
   - プロキシが実行されたら、「Claude Codeを起動」をクリック
   - 環境変数を使用してプロキシに接続

## 設定

### 環境変数

アプリケーションは以下の環境変数を自動的に設定します：

```bash
export ANTHROPIC_BASE_URL=http://localhost:8082/v1
export ANTHROPIC_API_KEY=your-api-key
```

### 設定ファイルの場所

設定ファイルは以下に保存されます：
- Windows：`%APPDATA%/claude-code-proxy-pro`
- macOS：`~/Library/Application Support/claude-code-proxy-pro`
- Linux：`~/.config/claude-code-proxy-pro`

## 開発

### プロジェクト構造

```
claude-code-proxy-pro/
├── src/
│   ├── main/          # メインプロセスモジュール
│   ├── renderer/      # レンダラープロセス
│   └── preload/       # プリロードスクリプト
├── public/            # 静的リソース
├── locales/           # 言語ファイル
├── test/              # テストファイル
└── scripts/           # ビルドスクリプト
```

### 開発コマンド

```bash
# 開発モードを開始
npm run dev

# テストを実行
npm test

# すべてのプラットフォーム用にビルド
npm run build:all

# アイコンを生成
npm run icons
```

## 貢献

貢献を歓迎します！お気軽にPull Requestを提出してください。

1. リポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. Pull Requestを作成

## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細については[LICENSE](LICENSE)ファイルをご覧ください。

## 謝辞

- [Electron](https://www.electronjs.org/)で構築
- モダンな開発者ツールにインスパイアされたUIデザイン
- すべての貢献者とユーザーに感謝します

## サポート

問題が発生した場合や提案がある場合：
- [GitHub Issues](https://github.com/miounet11/claude-code-proxy-pro/issues)で問題を報告
- 連絡先：support@claude-code-proxy.com