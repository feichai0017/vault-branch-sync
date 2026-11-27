# Vault Branch Sync 使用说明

用一个 GitHub 私有仓库在电脑、iPhone、iPad 和其他装有 Obsidian 的设备间同步笔记。离线时直接写，联网后按一次同步。每次提交都可以在自己的仓库里查看。

## 第一次接入

1. 使用 Obsidian 1.11.4 或更新版本。在社区插件里启用 **Vault Branch Sync**。手动安装时，把同一发行版的 `main.js` 和 `manifest.json` 放入库内的 `.obsidian/plugins/vault-branch-sync/`，重新打开 Obsidian。[GitHub 安装包](https://github.com/feichai0017/vault-branch-sync/releases/latest)
2. 为笔记准备一个 GitHub **私有**仓库。打开 **设置 → Vault Branch Sync**，填入 `用户名/仓库名`。分支留空会采用仓库的默认分支，其他分支需先在 GitHub 创建。
3. 在 GitHub 创建细粒度令牌，选择 **Only select repositories**，只勾选自己的笔记仓库，把 **Contents** 设为 **Read and write**。在插件里粘贴令牌，点 **保存连接**。每台设备单独设置一次。[GitHub 官方说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
4. 点 **仅接收**。首次下载时，本机独有的草稿留在本机。如果远端是空仓库，在已经有笔记的那台设备再点 **预览同步改动**，勾选要首次上传的文件。空仓库的首次上传会先用一个已选文件建立分支，其余已选文件进入第二个提交。

## 平时怎么用

写完笔记，点侧栏同步图标或运行 **与 GitHub 同步**。预览会列出待接收的文件，以及本机新增、修改和删除的文件。可以把论文笔记、配图和学习首页一起勾选，再点 **应用选择**。未选的草稿留在本机，下次预览仍可勾选。点 **取消** 会直接关闭预览。

勾选一篇笔记后，**已选笔记引用的改动配图** 会列出这篇笔记链接或嵌入的新增、修改图片。点某个文件旁的 **勾选配图** 将它加入同一提交。笔记只链接了 Excalidraw 源图或 SVG 时，列表也会寻找有改动的配套文件。

在想自动接收的设备上，开启 **打开笔记库或回到前台时自动接收**。切回 Obsidian 会接收 GitHub 更新。普通 Markdown 中互不重叠的修改会合到本机，重叠的修改留待手动处理。**本设备同步状态** 和命令 **查看同步状态** 显示上次成功同步的时间和最近一次检查的结果。

### 两台设备都改了同一篇

插件用上次同步的 Git 文件版本做三方合并。例如，Mac 修正了公式，iPhone 在另一段补写思考，接收后手机正文会包含两处修改。下次勾选这篇正文就能把结果传回 GitHub。在手动同步中选 **合并并提交**，也可以当场上传。

如果两边改到同一处，在预览里选 **合并到本机** 或 **合并并提交**。每处重叠都能看到「上次同步」「本机」和「GitHub」三份文字。逐处选要留下的一边，再点 **应用选择**。三方合并支持每版不超过 512 KiB、10,000 行且换行格式一致的 UTF-8 Markdown。绘图、一端已删除的文件和没有共同版本的同名新文件可用下面的整份处理方式。

每个冲突文件都能单独决定。Markdown 笔记可展开 **比较段落**，查看本机与 GitHub 的文字差异。选 **提交本机版本** 会提交本机内容或删除操作。仅接收时，也可以选 **保留本机改动，稍后提交**，下次再勾选上传。选 **采用 GitHub 版本** 会让原路径采用远端内容。选 **保留两份** 会把本机副本存入 `Sync conflicts/`，原路径采用 GitHub 版本。远端已删除的原文件会移入本机废纸篓。选 **稍后处理** 会把冲突留到下次，其他文件照常同步。绘图、图片等附件可以保留两份，文字对比支持每个版本不超过 512 KiB。

### 恢复单篇笔记

打开 Markdown 笔记，从命令面板或文件菜单运行 **查看本篇 GitHub 历史**。列表按每页 20 条显示当前分支上这个路径的提交。点 **预览 → 恢复为副本**，插件会在原笔记旁创建带短提交号的新文件。当前笔记和已有副本都保留。新副本在你勾选提交后才会上传。

## 同步范围

- 默认同步正文、Canvas、Bases 和附件。根目录和子目录的 `.gitignore` 可以排除新增文件。GitHub 的单文件上限是 100 MiB。
- 按需开启 **同步常用设置与主题**，可以一起同步外观、快捷键、主题和 CSS 片段。两端的配置目录名需要相同，接收后重新打开库即可加载外观。
- 插件程序、启用列表、工作区布局、Git 元数据和令牌由每台设备各自管理。建议一个文件夹使用一种同步方式。插件会读写 Obsidian 管理的库文件，本地 Git 客户端自行维护暂存区和本地分支。
- 连接、同步、查看历史和恢复副本会直接访问 GitHub 私有仓库。上传由你手动发起。令牌存在本机的 Obsidian 密钥存储中。代码和发布包使用 MIT 许可证。[英文说明与构建命令](README.md)

## 验证发布包

从要安装的 GitHub Release 下载 `main.js`，在文件所在目录用 GitHub CLI 验证签名。

```sh
gh attestation verify main.js --repo feichai0017/vault-branch-sync --signer-workflow feichai0017/vault-branch-sync/.github/workflows/release-provenance.yml --deny-self-hosted-runners
```

发版时，把 `main.js` 和 `manifest.json` 一起附在 GitHub Release 里。发布后，GitHub Actions 自动检出对应标签、运行测试并重新构建。只有构建产物和发布的 `main.js` 逐字节一致，才会为它的 SHA-256 摘要签发证明。要给旧版本补签，可以在 Actions 的 **Release provenance** 里填写已发布的标签。签名记录里可以查到重建使用的源码提交。[发版工作流](.github/workflows/release-provenance.yml)
