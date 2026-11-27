# Vault Branch Sync 使用说明

用一个 GitHub 私有仓库在电脑、iPhone、iPad 和其他装有 Obsidian 的设备间同步笔记。离线时直接写，联网后按一次同步。每次提交都可以在自己的仓库里查看。

## 第一次接入

1. 使用 Obsidian 1.11.4 或更新版本。在社区插件里启用 **Vault Branch Sync**。手动安装时，把同一发行版的 `main.js` 和 `manifest.json` 放入库内的 `.obsidian/plugins/vault-branch-sync/`，重新打开 Obsidian。[GitHub 安装包](https://github.com/feichai0017/vault-branch-sync/releases/latest)
2. 为笔记准备一个 GitHub **私有**仓库。打开 **设置 → Vault Branch Sync**，填入 `用户名/仓库名`。分支留空会采用仓库的默认分支，其他分支需先在 GitHub 创建。
3. 在 GitHub 创建细粒度令牌，选择 **Only select repositories**，只勾选自己的笔记仓库，把 **Contents** 设为 **Read and write**。在插件里粘贴令牌，点 **保存连接**。每台设备单独设置一次。[GitHub 官方说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
4. 点 **仅接收**。首次只下载，本机独有的草稿留在本机。如果远端是空仓库，在已经有笔记的那台设备再点 **立即同步**，即可建立第一个提交。

## 平时怎么用

换设备时先点 **仅接收**，编辑完点侧栏的同步图标或运行命令 **与 GitHub 同步**。更换仓库、分支或设置同步范围后，会重新做一次只接收的比较。

两台设备都改过同一篇时，选择 **取消** 可以自己检查。选择 **保留两份** 会把本机版本另存到 `Sync conflicts/`，原文件位置采用 GitHub 版本。远端已删除的原文件进入本机废纸篓。整理好后，下次完整同步即可上传副本。

## 同步范围

- 默认同步正文、Canvas、Bases 和附件。根目录和子目录的 `.gitignore` 可以排除新增文件。GitHub 的单文件上限是 100 MiB。
- 按需开启 **同步常用设置与主题**，可以一起同步外观、快捷键、主题和 CSS 片段。两端的配置目录名需要相同，接收后重新打开库即可加载外观。
- 插件程序、启用列表、工作区布局、Git 元数据和令牌由每台设备各自管理。建议一个文件夹使用一种同步方式。插件会读写 Obsidian 管理的库文件，本地 Git 客户端自行维护暂存区和本地分支。
- 连接与同步时，插件直接请求 GitHub。令牌存在本机的 Obsidian 密钥存储中。代码和发布包使用 MIT 许可证。[英文说明与构建命令](README.md)

## 验证发布包

从要安装的 GitHub Release 下载 `main.js`，在文件所在目录用 GitHub CLI 验证签名。

```sh
gh attestation verify main.js --repo feichai0017/vault-branch-sync --signer-workflow feichai0017/vault-branch-sync/.github/workflows/release-provenance.yml --deny-self-hosted-runners
```

发版时，把 `main.js` 和 `manifest.json` 一起附在 GitHub Release 里。发布后，GitHub Actions 自动检出对应标签、运行测试并重新构建。只有构建产物和发布的 `main.js` 逐字节一致，才会为它的 SHA-256 摘要签发证明。要给旧版本补签，可以在 Actions 的 **Release provenance** 里填写已发布的标签。签名记录里可以查到重建使用的源码提交。[发版工作流](.github/workflows/release-provenance.yml)
