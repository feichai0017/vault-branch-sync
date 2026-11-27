# Vault Branch Sync

Sync notes and attachments between desktop and mobile through a private GitHub repository. Each device keeps a local copy for offline writing. You choose when to receive changes or send a Git commit. [中文使用说明](README.zh-CN.md)

## Connect a vault

1. Use Obsidian 1.11.4 or later. Install **Vault Branch Sync** and enable it under **Community plugins**. To install a GitHub release manually, place its `main.js` and `manifest.json` together in `.obsidian/plugins/vault-branch-sync/`, then reload Obsidian. [Download a release](https://github.com/feichai0017/vault-branch-sync/releases/latest)
2. Create a **private** GitHub repository for the vault, or choose an existing private repository. The default branch of an empty repository works too. To sync with a different branch, create it on GitHub first.
3. In **Settings → Vault Branch Sync**, enter `owner/repository`. Leave **Branch** blank to use the repository's default branch. Create a fine-grained GitHub token, select only this repository and grant **Contents → Read and write**. Paste the token into the plugin and select **Save connection**. [GitHub token instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
4. Select **Receive changes** on each device. The first sync downloads the branch and preserves local drafts. For an empty repository, then select **Review changes** on the device with your notes and choose the files for the first upload. A switch to another repository, branch or file scope starts with another download. For that first upload to an empty repository, GitHub initializes the branch with one selected file and commits any remaining selection in a second commit.

## Daily use

After writing, click the sync icon or run **Vault Branch Sync: Sync with GitHub**. The preview lists incoming files and local additions, edits and deletions. Select the files to commit, then choose **Apply choices**. For example, select a paper note, its figure and its index. Unchecked drafts stay on the device and appear in the next preview. **Cancel** closes the preview before any files change.

In settings, enable **Receive when opening or returning to this vault** on each device where you want it. Opening the vault or returning to the app downloads incoming changes. Conflicting files wait for your decision. **Sync status on this device** and the **Show sync status** command show the last successful sync and the latest counts. The desktop status bar also shows the time. You can still select **Receive changes** manually.

Choose a resolution separately for each conflict. **Compare paragraphs** shows the differing Markdown text on this device and GitHub. **Commit local version** submits the local file (or its deletion). During a receive-only sync, **Keep local change for a later commit** leaves the edit available in the next upload preview. **Use GitHub version** applies the remote change to the original path. **Keep both** keeps a local copy in `Sync conflicts/` and applies the remote version at the original path. A remote deletion moves the original to the vault trash. **Decide later** carries this conflict into the next review while other files sync. Drawings and binary attachments support keeping both copies. Text previews cover up to 512 KiB per version.

## What travels

- Visible vault files, including Markdown, canvases, bases and binary attachments, are eligible for sync. A root or nested `.gitignore` can exclude new local files. Previously tracked files continue to sync.
- **Include settings and themes** also transfers portable settings such as appearance and hotkeys, theme files and CSS snippets. Use the same configuration folder name across devices to share those files. Reopen the vault to apply downloaded appearance changes.
- Git metadata, hidden directories, community plugin programs, plugin enable lists, plugin credentials and device workspace layouts stay local. Use one sync tool for a given folder. In a local Git checkout, this plugin changes the vault files while your Git client manages its own index and branches.
- GitHub limits individual Git blobs to 100 MiB. This plugin uses ordinary Git blobs for attachments. Keep Git LFS material in a Git LFS workflow.

## Network and privacy

The plugin contacts `api.github.com` when you connect, sync manually, or enable foreground receiving and return to the vault. Downloads use your chosen private repository. Uploading selected files requires a manual sync. The plugin verifies downloaded Git blobs and checks the expected branch revision before updating it. A newer push triggers a fresh comparison.

Your token is kept in Obsidian's secret storage on the device. The connection and last-seen file revisions are local to the vault. The plugin has no telemetry, analytics or intermediary server.

## Development

Install Node.js 22 or later and run:

```sh
npm ci
npm test
npm run build
```

The build writes `main.js` beside `manifest.json`. The tests use disposable folders and synthetic vault files. They cover interrupted downloads, empty repositories, concurrent pushes, delete/edit conflicts, branch selection and file exclusions. [MIT license](LICENSE) · [node-ignore, included under MIT](https://github.com/kaelzhang/node-ignore)

## Verify a release

Download `main.js` from the release you want to install, then run this command in its folder with the GitHub CLI.

```sh
gh attestation verify main.js --repo feichai0017/vault-branch-sync --signer-workflow feichai0017/vault-branch-sync/.github/workflows/release-provenance.yml --deny-self-hosted-runners
```

Publish each GitHub release with `main.js` and `manifest.json` attached. GitHub Actions rebuilds the tagged source, runs the tests, and signs the SHA-256 digest only if the build matches the published `main.js` byte for byte. To backfill a published release, run **Release provenance** from the Actions tab and enter its tag. The signed record includes the source commit used for the rebuild. [Release workflow](.github/workflows/release-provenance.yml)
