/* Includes node-ignore.
Copyright (c) 2013 Kael Zhang <i@kael.me>, contributors
http://kael.me/

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Includes node-diff3.
### The MIT License (MIT)

diff function extracted from Project Synchrotron.

For more detail please visit:
- https://leastfixedpoint.com/tonyg/kcbbs/projects/synchrotron.html
- https://github.com/tonyg/synchrotron

Copyright (c) 2006, 2008 Tony Garnock-Jones &lt;tonyg@lshift.net&gt;<br/>
Copyright (c) 2006, 2008 LShift Ltd. &lt;query@lshift.net&gt;<br/>
Copyright (c) 2019-2026 Bryan Housel &lt;bhousel@gmail.com&gt;<br/>

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports, module2) {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var UNDEFINED = void 0;
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_TEST_BLANK_LINE = /^\s+$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var REGEX_TEST_INVALID_PATH = /^\.{0,2}\/|^\.{1,2}$/;
    var REGEX_TEST_TRAILING_SLASH = /\/$/;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define = (object, key, value) => {
      Object.defineProperty(object, key, { value });
      return value;
    };
    var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
    var RETURN_FALSE = () => false;
    var sanitizeRange = (range) => range.replace(
      REGEX_REGEXP_RANGE,
      (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY
    );
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var REPLACERS = [
      [
        // Remove BOM
        // TODO:
        // Other similar zero-width characters?
        /^\uFEFF/,
        () => EMPTY
      ],
      // > Trailing spaces are ignored unless they are quoted with backslash ("\")
      [
        // (a\ ) -> (a )
        // (a  ) -> (a)
        // (a ) -> (a)
        // (a \ ) -> (a  )
        /((?:\\\\)*?)(\\?\s+)$/,
        (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      // Replace (\ ) with ' '
      // (\ ) -> ' '
      // (\\ ) -> '\\ '
      // (\\\ ) -> '\\ '
      [
        /(\\+?)\s/g,
        (_, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      // Escape metacharacters
      // which is written down by users but means special for regular expressions.
      // > There are 12 characters with special meanings:
      // > - the backslash \,
      // > - the caret ^,
      // > - the dollar sign $,
      // > - the period or dot .,
      // > - the vertical bar or pipe symbol |,
      // > - the question mark ?,
      // > - the asterisk or star *,
      // > - the plus sign +,
      // > - the opening parenthesis (,
      // > - the closing parenthesis ),
      // > - and the opening square bracket [,
      // > - the opening curly brace {,
      // > These special characters are often called "metacharacters".
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        // > a question mark (?) matches a single character
        /(?!\\)\?/g,
        () => "[^/]"
      ],
      // leading slash
      [
        // > A leading slash matches the beginning of the pathname.
        // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname
        /^\//,
        () => "^"
      ],
      // replace special metacharacter slash after the leading slash
      [
        /\//g,
        () => "\\/"
      ],
      [
        // > A leading "**" followed by a slash means match in all directories.
        // > For example, "**/foo" matches file or directory "foo" anywhere,
        // > the same as pattern "foo".
        // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
        // >   under directory "foo".
        // Notice that the '*'s have been replaced as '\\*'
        /^\^*\\\*\\\*\\\//,
        // '**/foo' <-> 'foo'
        () => "^(?:.*\\/)?"
      ],
      // starting
      [
        // there will be no leading '/'
        //   (which has been replaced by section "leading slash")
        // If starts with '**', adding a '^' to the regular expression also works
        /^(?=[^^])/,
        function startingReplacer() {
          return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
        }
      ],
      // two globstars
      [
        // Use lookahead assertions so that we could match more than one `'/**'`
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        // Check if it is not the last `'/**'`
        (_, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
      ],
      // normal intermediate wildcards
      [
        // Never replace escaped '*'
        // ignore rule '\*' will match the path '*'
        // 'abc.*/' -> go
        // 'abc.*'  -> skip this rule,
        //    coz trailing single wildcard will be handed by [trailing wildcard]
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        // '*.js' matches '.js'
        // '*.js' doesn't match 'abc'
        (_, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        }
      ],
      [
        // unescape, revert step 3 except for back slash
        // For example, if a user escape a '\\*',
        // after step 3, the result will be '\\\\\\*'
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE
      ],
      [
        // '\\\\' -> '\\'
        /\\\\/g,
        () => ESCAPE
      ],
      [
        // > The range notation, e.g. [a-zA-Z],
        // > can be used to match one of the characters in a range.
        // `\` is escaped by step 3
        /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
        (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${sanitizeRange(range)}${endEscape}]` : "[]" : "[]"
      ],
      // ending
      [
        // 'js' will not match 'js.'
        // 'ab' will not match 'abc'
        /(?:[^*])$/,
        // WTF!
        // https://git-scm.com/docs/gitignore
        // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
        // which re-fixes #24, #38
        // > If there is a separator at the end of the pattern then the pattern
        // > will only match directories, otherwise the pattern can match both
        // > files and directories.
        // 'js*' will not match 'a.js'
        // 'js/' will not match 'a.js'
        // 'js' will match 'a.js' and 'a.js/'
        (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
      ]
    ];
    var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\\\*$/;
    var MODE_IGNORE = "regex";
    var MODE_CHECK_IGNORE = "checkRegex";
    var UNDERSCORE = "_";
    var TRAILING_WILD_CARD_REPLACERS = {
      [MODE_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      },
      [MODE_CHECK_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      }
    };
    var makeRegexPrefix = (pattern) => REPLACERS.reduce(
      (prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)),
      pattern
    );
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);
    var IgnoreRule = class {
      constructor(pattern, mark, body, ignoreCase, negative, prefix) {
        this.pattern = pattern;
        this.mark = mark;
        this.negative = negative;
        define(this, "body", body);
        define(this, "ignoreCase", ignoreCase);
        define(this, "regexPrefix", prefix);
      }
      get regex() {
        const key = UNDERSCORE + MODE_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_IGNORE, key);
      }
      get checkRegex() {
        const key = UNDERSCORE + MODE_CHECK_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_CHECK_IGNORE, key);
      }
      _make(mode, key) {
        const str = this.regexPrefix.replace(
          REGEX_REPLACE_TRAILING_WILDCARD,
          // It does not need to bind pattern
          TRAILING_WILD_CARD_REPLACERS[mode]
        );
        const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
        return define(this, key, regex);
      }
    };
    var createRule = ({
      pattern,
      mark
    }, ignoreCase) => {
      let negative = false;
      let body = pattern;
      if (body.indexOf("!") === 0) {
        negative = true;
        body = body.substr(1);
      }
      body = body.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regexPrefix = makeRegexPrefix(body);
      return new IgnoreRule(
        pattern,
        mark,
        body,
        ignoreCase,
        negative,
        regexPrefix
      );
    };
    var RuleManager = class {
      constructor(ignoreCase) {
        this._ignoreCase = ignoreCase;
        this._rules = [];
      }
      _add(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules._rules);
          this._added = true;
          return;
        }
        if (isString(pattern)) {
          pattern = {
            pattern
          };
        }
        if (checkPattern(pattern.pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
        }
      }
      // @param {Array<string> | string | Ignore} pattern
      add(pattern) {
        this._added = false;
        makeArray(
          isString(pattern) ? splitPattern(pattern) : pattern
        ).forEach(this._add, this);
        return this._added;
      }
      // Test one single path without recursively checking parent directories
      //
      // - checkUnignored `boolean` whether should check if the path is unignored,
      //   setting `checkUnignored` to `false` could reduce additional
      //   path matching.
      // - check `string` either `MODE_IGNORE` or `MODE_CHECK_IGNORE`
      // @returns {TestResult} true if a file is ignored
      test(path, checkUnignored, mode) {
        let ignored = false;
        let unignored = false;
        let matchedRule;
        this._rules.forEach((rule) => {
          const { negative } = rule;
          if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
            return;
          }
          const matched = rule[mode].test(path);
          if (!matched) {
            return;
          }
          ignored = !negative;
          unignored = negative;
          matchedRule = negative ? UNDEFINED : rule;
        });
        const ret = {
          ignored,
          unignored
        };
        if (matchedRule) {
          ret.rule = matchedRule;
        }
        return ret;
      }
    };
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path, originalPath, doThrow) => {
      if (!isString(path)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path) => REGEX_TEST_INVALID_PATH.test(path);
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;
    var Ignore = class {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define(this, KEY_IGNORE, true);
        this._rules = new RuleManager(ignoreCase);
        this._strictPathCheck = !allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = /* @__PURE__ */ Object.create(null);
        this._testCache = /* @__PURE__ */ Object.create(null);
      }
      add(pattern) {
        if (this._rules.add(pattern)) {
          this._initCache();
        }
        return this;
      }
      // legacy
      addPattern(pattern) {
        return this.add(pattern);
      }
      // @returns {TestResult}
      _test(originalPath, cache, checkUnignored, slices) {
        const path = originalPath && checkPath.convert(originalPath);
        checkPath(
          path,
          originalPath,
          this._strictPathCheck ? throwError : RETURN_FALSE
        );
        return this._t(path, cache, checkUnignored, slices);
      }
      checkIgnore(path) {
        if (!REGEX_TEST_TRAILING_SLASH.test(path)) {
          return this.test(path);
        }
        const slices = path.split(SLASH).filter(Boolean);
        slices.pop();
        if (slices.length) {
          const parent2 = this._t(
            slices.join(SLASH) + SLASH,
            this._testCache,
            true,
            slices
          );
          if (parent2.ignored) {
            return parent2;
          }
        }
        return this._rules.test(path, false, MODE_CHECK_IGNORE);
      }
      _t(path, cache, checkUnignored, slices) {
        if (path in cache) {
          return cache[path];
        }
        if (!slices) {
          slices = path.split(SLASH).filter(Boolean);
        }
        slices.pop();
        if (!slices.length) {
          return cache[path] = this._rules.test(path, checkUnignored, MODE_IGNORE);
        }
        const parent2 = this._t(
          slices.join(SLASH) + SLASH,
          cache,
          checkUnignored,
          slices
        );
        return cache[path] = parent2.ignored ? parent2 : this._rules.test(path, checkUnignored, MODE_IGNORE);
      }
      ignores(path) {
        return this._test(path, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path) => !this.ignores(path);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path) {
        return this._test(path, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore(options);
    var isPathValid = (path) => checkPath(path && checkPath.convert(path), path, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path) || isNotRelative(path);
    };
    if (
      // Detect `process` so that it can run in browsers.
      typeof process !== "undefined" && process.platform === "win32"
    ) {
      setupWindows();
    }
    module2.exports = factory;
    factory.default = factory;
    module2.exports.isPathValid = isPathValid;
    define(module2.exports, Symbol.for("setupWindows"), setupWindows);
  }
});

// src/plugin.js
var plugin_exports = {};
__export(plugin_exports, {
  default: () => VaultBranchSync
});
module.exports = __toCommonJS(plugin_exports);
var import_obsidian3 = require("obsidian");

// src/oid.js
var utf8 = new TextEncoder();
var validOid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
async function blobOid(data) {
  const bytes = new Uint8Array(data);
  const header = utf8.encode("blob " + bytes.length + "\0");
  const blob = new Uint8Array(header.length + bytes.length);
  blob.set(header);
  blob.set(bytes, header.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", blob));
  return Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
}

// src/compare.js
var maxPreviewBytes = 512 * 1024;
var maxCells = 16e4;
function isMarkdownNote(path) {
  return /\.md$/i.test(path) && !/\.excalidraw\.md$/i.test(path);
}
function isDrawingText(text) {
  const header = text.slice(0, 2e3).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n---")[0];
  return header.startsWith("---\n") && /^excalidraw-plugin:/m.test(header);
}
function compareParagraphs(local, remote) {
  const paragraphs = (text) => text ? text.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/) : [];
  const leftText = paragraphs(local), rightText = paragraphs(remote);
  let start = 0, leftEnd = leftText.length, rightEnd = rightText.length;
  while (start < leftEnd && start < rightEnd && leftText[start] === rightText[start]) start++;
  while (leftEnd > start && rightEnd > start && leftText[leftEnd - 1] === rightText[rightEnd - 1]) {
    leftEnd--;
    rightEnd--;
  }
  const left = leftText.slice(start, leftEnd), right = rightText.slice(start, rightEnd);
  const width = right.length + 1;
  if ((left.length + 1) * width > maxCells) {
    return {
      kind: "excerpts",
      number: start + 1,
      local: left.join("\n\n").slice(0, 3500),
      remote: right.join("\n\n").slice(0, 3500)
    };
  }
  const lengths = new Uint32Array((left.length + 1) * width);
  for (let i2 = left.length - 1; i2 >= 0; i2--) {
    for (let j2 = right.length - 1; j2 >= 0; j2--) {
      const pos = i2 * width + j2;
      lengths[pos] = left[i2] === right[j2] ? 1 + lengths[pos + width + 1] : Math.max(lengths[pos + width], lengths[pos + 1]);
    }
  }
  const changes = [];
  let i = 0, j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      i++;
      j++;
    } else if (i < left.length && (j === right.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      changes.push({ side: "local", number: start + i + 1, text: left[i++] });
    } else {
      changes.push({ side: "remote", number: start + j + 1, text: right[j++] });
    }
  }
  return { kind: "paragraphs", changes };
}
async function compareNote(change, adapter, api, remoteSize) {
  if (!isMarkdownNote(change.path)) return { kind: "attachment" };
  await adapter.flush?.(change.path);
  const stat = await adapter.stat(change.path);
  if (Boolean(stat) !== Boolean(change.here) || stat?.type === "folder") {
    throw new Error("Local file changed. Reopen the review: " + change.path);
  }
  if (stat?.size > maxPreviewBytes || remoteSize > maxPreviewBytes) return { kind: "large" };
  const [local, remote] = await Promise.all([
    change.here ? adapter.readBinary(change.path) : null,
    change.there ? api.readBlob(change.there) : null
  ]);
  if (local && await blobOid(local) !== change.here) throw new Error("Local file changed. Reopen the review: " + change.path);
  if (local?.byteLength > maxPreviewBytes || remote?.byteLength > maxPreviewBytes) return { kind: "large" };
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let left, right;
  try {
    left = local ? decoder.decode(local) : "";
    right = remote ? decoder.decode(remote) : "";
  } catch {
    return { kind: "attachment" };
  }
  if (isDrawingText(left) || isDrawingText(right)) return { kind: "attachment" };
  return compareParagraphs(left, right);
}

// src/attachments.js
var picture = /\.(?:svg|png|jpe?g|webp|gif|bmp|avif|heic|tiff?)$/i;
function relatedFigures(note, eligible, metadata, resolve, isDrawing) {
  if (!isMarkdownNote(note) || isDrawing(note) || !metadata) return [];
  const related = /* @__PURE__ */ new Set();
  const add = (path) => {
    if (eligible.has(path)) related.add(path);
  };
  for (const { link } of [...metadata.embeds || [], ...metadata.links || []]) {
    const path = resolve(link, note);
    if (!path) continue;
    if (isDrawing(path)) {
      add(path);
      const stem = path.replace(/\.md$/i, "");
      for (const name of /* @__PURE__ */ new Set([stem, stem.replace(/\.excalidraw$/i, "")])) {
        for (const ending of [".svg", ".dark.svg", ".light.svg", ".png"]) add(name + ending);
      }
    } else if (picture.test(path)) {
      add(path);
      const stem = path.replace(/(?:\.(?:dark|light))?\.[^.]+$/i, "");
      for (const candidate of [stem + ".md", stem + ".excalidraw.md", stem + ".excalidraw"]) {
        if (eligible.has(candidate) && isDrawing(candidate)) add(candidate);
      }
    }
  }
  return [...related].sort();
}

// src/history-modal.js
var import_obsidian2 = require("obsidian");

// src/history.js
async function restoreCopy(vault, originalPath, commit, bytes) {
  if (!validOid(commit) || !/\.md$/i.test(originalPath)) throw new Error("Invalid Markdown revision.");
  const stem = originalPath.slice(0, -3) + " (history " + commit.slice(0, 12);
  for (let n = 1; ; n++) {
    const path = stem + (n > 1 ? "-" + n : "") + ").md";
    if (await vault.adapter.exists(path)) continue;
    try {
      return await vault.createBinary(path, bytes);
    } catch (error) {
      if (!await vault.adapter.exists(path)) throw error;
    }
  }
}

// src/review.js
var import_obsidian = require("obsidian");
var t = (en, zh) => (0, import_obsidian.getLanguage)().startsWith("zh") ? zh : en;
function editLabel(before, after) {
  if (!after) return t("Deleted", "\u5220\u9664");
  return before ? t("Modified", "\u4FEE\u6539") : t("Added", "\u65B0\u589E");
}
function showText(el, text) {
  const paragraph = el.createEl("p");
  for (const [index, line] of text.split("\n").entries()) {
    if (index) paragraph.createEl("br");
    paragraph.appendText(line);
  }
}
function renderComparison(el, comparison) {
  const side = (name) => name === "local" ? t("This device", "\u672C\u673A") : "GitHub";
  if (comparison.kind === "large" || comparison.kind === "attachment") {
    el.createEl("p", { text: comparison.kind === "large" ? t("Paragraph previews support notes up to 512 KiB per version.", "\u6BB5\u843D\u5BF9\u6BD4\u652F\u6301\u6BCF\u4E2A\u7248\u672C\u4E0D\u8D85\u8FC7 512 KiB \u7684\u7B14\u8BB0\u3002") : t("This is a drawing or binary attachment. Keep both to inspect the two files.", "\u8FD9\u662F\u7ED8\u56FE\u6216\u4E8C\u8FDB\u5236\u9644\u4EF6\uFF0C\u53EF\u4FDD\u7559\u4E24\u4EFD\u540E\u5206\u522B\u67E5\u770B\u3002") });
    return;
  }
  if (comparison.kind === "excerpts") {
    el.createEl("p", { text: t("Showing excerpts from the first differing paragraph", "\u4EE5\u4E0B\u8282\u9009\u4ECE\u4E24\u4EFD\u7B14\u8BB0\u7684\u9996\u4E2A\u5DEE\u5F02\u6BB5\u843D\u5F00\u59CB") + " \xB7 " + comparison.number });
    for (const name of ["local", "remote"]) {
      el.createEl("strong", { text: side(name) });
      showText(el, comparison[name]);
    }
    return;
  }
  if (!comparison.changes.length) {
    el.createEl("p", { text: t("Paragraph text matches after normalizing line endings.", "\u7EDF\u4E00\u6362\u884C\u683C\u5F0F\u540E\uFF0C\u4E24\u8FB9\u7684\u6BB5\u843D\u6587\u5B57\u4E00\u81F4\u3002") });
    return;
  }
  for (const item of comparison.changes.slice(0, 80)) {
    el.createEl("strong", { text: side(item.side) + t(" \xB7 paragraph ", " \xB7 \u7B2C ") + item.number + t("", " \u6BB5") });
    showText(el, item.text.length > 3500 ? item.text.slice(0, 3500) + "\u2026" : item.text);
  }
  if (comparison.changes.length > 80) el.createEl("p", { text: t("Showing the first 80 differing paragraphs.", "\u4EE5\u4E0A\u4E3A\u524D 80 \u4E2A\u5DEE\u5F02\u6BB5\u843D\u3002") });
}
var SyncReview = class extends import_obsidian.Modal {
  constructor(app, plan, compare, finish, figures = () => []) {
    super(app);
    this.plan = plan;
    this.compare = compare;
    this.finish = finish;
    this.figures = figures;
    this.selected = /* @__PURE__ */ new Set();
    this.conflicts = /* @__PURE__ */ new Map();
    this.result = null;
  }
  onOpen() {
    this.setTitle(t("Review sync changes", "\u9884\u89C8\u540C\u6B65\u6539\u52A8"));
    const el = this.contentEl;
    if (this.plan.incoming.length) {
      const section = el.createEl("details");
      section.createEl("summary", { text: t("Receive from GitHub", "\u4ECE GitHub \u63A5\u6536") + " (" + this.plan.incoming.length + ")" });
      const list = section.createEl("ul");
      for (const change of this.plan.incoming) list.createEl("li", { text: editLabel(change.before, change.there) + " \xB7 " + change.path });
    }
    if (this.plan.outgoing.length) this.showOutgoing(el);
    if (this.plan.conflicts.length) {
      el.createEl("h3", { text: t("Conflicts", "\u51B2\u7A81\u6587\u4EF6") });
      el.createEl("p", { text: t(
        "Choose a version for each file. Keep both saves a local copy in Sync conflicts and puts the GitHub version at the original path.",
        "\u9010\u4E2A\u9009\u62E9\u8981\u4FDD\u7559\u7684\u7248\u672C\u3002\u9009\u300C\u4FDD\u7559\u4E24\u4EFD\u300D\u4F1A\u628A\u672C\u673A\u526F\u672C\u5B58\u5165 Sync conflicts\uFF0C\u539F\u8DEF\u5F84\u91C7\u7528 GitHub \u7248\u672C\u3002"
      ) });
      for (const change of this.plan.conflicts) this.showConflict(el, change);
    }
    this.actions = new import_obsidian.Setting(el).addButton((b) => b.setButtonText(t("Cancel", "\u53D6\u6D88")).onClick(() => this.close())).addButton((b) => {
      this.applyButton = b.setButtonText(t("Apply choices", "\u5E94\u7528\u9009\u62E9")).setCta().onClick(() => {
        this.result = { selected: this.selected, conflicts: this.conflicts };
        this.close();
      });
    });
    this.actions.descEl.setAttribute("aria-live", "polite");
    this.updateCount();
  }
  updateCount() {
    if (!this.actions) return;
    const unresolved = [...this.conflicts.values()].some((choice) => choice?.kind === "merge" && choice.sides.some((side) => !side));
    this.applyButton.setDisabled(unresolved);
    if (unresolved) {
      this.actions.setDesc(t("Choose a version for each highlighted section.", "\u8BF7\u4E3A\u6BCF\u5904\u91CD\u53E0\u4FEE\u6539\u9009\u62E9\u4E00\u4E2A\u7248\u672C\u3002"));
      return;
    }
    if (!this.plan.canSend) {
      this.actions.setDesc("");
      return;
    }
    const localConflicts = [...this.conflicts.values()].filter((choice) => choice === "local" || choice?.send).length;
    this.actions.setDesc(t("Files to commit", "\u672C\u6B21\u63D0\u4EA4\u7684\u6587\u4EF6") + " \xB7 " + (this.selected.size + localConflicts));
  }
  showOutgoing(el) {
    const toggles = /* @__PURE__ */ new Map();
    const cache = /* @__PURE__ */ new Map();
    const suggestions = el.createDiv();
    const refreshFigures = () => {
      suggestions.empty();
      const related = /* @__PURE__ */ new Set();
      for (const path of this.selected) {
        if (!cache.has(path)) cache.set(path, this.figures(path));
        for (const figure of cache.get(path)) if (!this.selected.has(figure)) related.add(figure);
      }
      if (!related.size) return;
      suggestions.createEl("h4", { text: t("Changed figures linked from selected notes", "\u5DF2\u9009\u7B14\u8BB0\u5F15\u7528\u7684\u6539\u52A8\u914D\u56FE") });
      for (const path of [...related].sort()) {
        new import_obsidian.Setting(suggestions).setName(path).addButton((b) => b.setButtonText(t("Include figure", "\u52FE\u9009\u914D\u56FE")).onClick(() => {
          this.selected.add(path);
          toggles.get(path).setValue(true);
          refreshFigures();
          this.updateCount();
        }));
      }
    };
    const setAll = (value) => {
      this.selected.clear();
      for (const [path, toggle] of toggles) {
        if (value) this.selected.add(path);
        toggle.setValue(value);
      }
      refreshFigures();
      this.updateCount();
    };
    new import_obsidian.Setting(el).setName(t("Commit to GitHub", "\u63D0\u4EA4\u5230 GitHub")).setHeading().addButton((b) => b.setButtonText(t("Select all", "\u5168\u9009")).onClick(() => setAll(true))).addButton((b) => b.setButtonText(t("Clear selection", "\u6E05\u7A7A\u9009\u62E9")).onClick(() => setAll(false)));
    for (const change of this.plan.outgoing) {
      new import_obsidian.Setting(el).setName(change.path).setDesc(editLabel(change.before, change.here)).addToggle((toggle) => {
        toggles.set(change.path, toggle);
        toggle.setValue(false).onChange((value) => {
          if (value) this.selected.add(change.path);
          else this.selected.delete(change.path);
          refreshFigures();
          this.updateCount();
        });
        toggle.toggleEl.setAttribute("aria-label", t("Commit ", "\u63D0\u4EA4 ") + change.path);
      });
    }
  }
  showConflict(el, change) {
    const group = el.createDiv();
    const model = this.plan.merges?.get(change.path);
    const sides = Array(model?.overlaps || 0).fill(null);
    let mergeControls;
    const states = t("This device", "\u672C\u673A") + " \xB7 " + editLabel(change.before, change.here) + " / GitHub \xB7 " + editLabel(change.before, change.there);
    new import_obsidian.Setting(group).setName(change.path).setDesc(states).addDropdown((input) => {
      input.addOption("later", t("Decide later", "\u7A0D\u540E\u5904\u7406"));
      if (model) {
        input.addOption("merge", t("Merge on this device", "\u5408\u5E76\u5230\u672C\u673A"));
        if (this.plan.canSend) input.addOption("merge-send", t("Merge and commit", "\u5408\u5E76\u5E76\u63D0\u4EA4"));
      }
      input.addOption("both", t("Keep both", "\u4FDD\u7559\u4E24\u4EFD"));
      input.addOption("remote", change.there ? t("Use GitHub version", "\u91C7\u7528 GitHub \u7248\u672C") : t("Apply GitHub deletion", "\u91C7\u7528 GitHub \u7684\u5220\u9664"));
      if (this.plan.canSend) input.addOption("local", change.here ? t("Commit local version", "\u63D0\u4EA4\u672C\u673A\u7248\u672C") : t("Commit local deletion", "\u63D0\u4EA4\u672C\u673A\u7684\u5220\u9664"));
      else input.addOption("keep-local", t("Keep local change for a later commit", "\u4FDD\u7559\u672C\u673A\u6539\u52A8\uFF0C\u7A0D\u540E\u63D0\u4EA4"));
      const choose = (value) => {
        const merging = value === "merge" || value === "merge-send";
        this.conflicts.set(change.path, merging ? { kind: "merge", sides, send: value === "merge-send" } : value);
        if (mergeControls) mergeControls.hidden = !merging;
        this.updateCount();
      };
      const initial = model?.overlaps === 0 ? "merge" : "later";
      input.setValue(initial).onChange(choose);
      choose(initial);
      input.selectEl.setAttribute("aria-label", t("Resolve ", "\u5904\u7406\u51B2\u7A81 ") + change.path);
    });
    if (model) {
      mergeControls = group.createDiv();
      mergeControls.hidden = model.overlaps > 0;
      if (!model.overlaps) mergeControls.createEl("p", { text: t(
        "Independent edits will be combined. You can commit the result later.",
        "\u4E24\u7AEF\u6539\u52A8\u53EF\u4EE5\u81EA\u52A8\u5408\u5E76\u3002\u5408\u5E76\u5230\u672C\u673A\u540E\uFF0C\u53EF\u5728\u4E0B\u6B21\u9884\u89C8\u65F6\u52FE\u9009\u63D0\u4EA4\u3002"
      ) });
      for (const part of model.parts.filter((item) => !item.lines)) {
        const hunk = mergeControls.createDiv();
        hunk.createEl("strong", { text: t("Overlapping edit at base line ", "\u91CD\u53E0\u4FEE\u6539\uFF0C\u5171\u540C\u7248\u672C\u7B2C ") + part.line });
        for (const [key, label] of [["base", t("Last synced", "\u4E0A\u6B21\u540C\u6B65")], ["local", t("This device", "\u672C\u673A")], ["remote", "GitHub"]]) {
          hunk.createEl("small", { text: label });
          hunk.createEl("pre", { text: part[key].length ? part[key].join("\n") : t("(no lines)", "\uFF08\u65E0\u5185\u5BB9\uFF09") });
        }
        new import_obsidian.Setting(hunk).setName(t("Keep in merged note", "\u6B64\u5904\u4FDD\u7559")).addDropdown((control) => {
          control.addOption("", t("Choose a version", "\u8BF7\u9009\u62E9")).addOption("local", t("This device", "\u672C\u673A")).addOption("remote", "GitHub").onChange((value) => {
            sides[part.index] = value || null;
            this.updateCount();
          });
        });
      }
    }
    if (!isMarkdownNote(change.path)) return;
    const details = group.createEl("details");
    details.createEl("summary", { text: t("Compare paragraphs", "\u6BD4\u8F83\u6BB5\u843D") });
    const body = details.createDiv();
    let loaded = false;
    details.addEventListener("toggle", async () => {
      if (!details.open || loaded) return;
      loaded = true;
      body.setText(t("Loading versions\u2026", "\u6B63\u5728\u8BFB\u53D6\u4E24\u4E2A\u7248\u672C\u2026"));
      try {
        const comparison = await this.compare(change);
        body.empty();
        renderComparison(body, comparison);
      } catch (error) {
        loaded = false;
        body.setText(error.message);
      }
    });
  }
  onClose() {
    this.contentEl.empty();
    this.finish(this.result);
  }
};

// src/history-modal.js
var NoteHistory = class extends import_obsidian2.Modal {
  constructor(app, file, api) {
    super(app);
    this.path = file.path;
    this.api = api;
    this.previewRequest = 0;
    this.page = 0;
  }
  onOpen() {
    this.historyOpen = true;
    this.setTitle(t("GitHub note history", "\u5355\u7BC7 GitHub \u5386\u53F2"));
    this.contentEl.createEl("p", { text: this.path });
    this.list = this.contentEl.createDiv();
    this.more = this.contentEl.createEl("button", { text: t("Load older versions", "\u52A0\u8F7D\u66F4\u65E9\u7684\u7248\u672C") });
    this.more.addEventListener("click", () => void this.nextPage());
    this.detail = this.contentEl.createDiv();
    void this.nextPage();
  }
  async nextPage() {
    this.more.disabled = true;
    try {
      if (!this.head) {
        await this.api.repository();
        this.head = await this.api.head();
      }
      const rows = this.head ? await this.api.noteHistory(this.path, this.head, this.page + 1) : [];
      if (!this.historyOpen) return;
      if (!this.page && !rows.length) this.list.setText(t("No commits for this path on this branch.", "\u6B64\u5206\u652F\u8FD8\u6CA1\u6709\u8FD9\u4E2A\u8DEF\u5F84\u7684\u63D0\u4EA4\u3002"));
      this.page++;
      for (const revision of rows) {
        new import_obsidian2.Setting(this.list).setName(revision.message).setDesc(revision.date.slice(0, 10) + " \xB7 " + revision.sha.slice(0, 12)).addButton((button) => button.setButtonText(t("Preview", "\u9884\u89C8")).onClick(() => void this.preview(revision)));
      }
      this.more.hidden = rows.length < 20;
    } catch (error) {
      if (this.historyOpen) new import_obsidian2.Notice(error.message, 8e3);
    } finally {
      this.more.disabled = false;
    }
  }
  async preview(revision) {
    const request = ++this.previewRequest;
    this.detail.setText(t("Loading revision\u2026", "\u6B63\u5728\u8BFB\u53D6\u5386\u53F2\u7248\u672C\u2026"));
    try {
      const item = await this.api.noteRevision(this.path, revision.sha);
      if (!this.historyOpen || request !== this.previewRequest) return;
      if (!item) {
        this.detail.setText(t("The note is absent in this commit. Choose an earlier version.", "\u8BE5\u63D0\u4EA4\u4E2D\u6CA1\u6709\u6B64\u6587\u4EF6\uFF0C\u53EF\u9009\u62E9\u66F4\u65E9\u7684\u7248\u672C\u3002"));
        return;
      }
      let bytes;
      if (item.size <= maxPreviewBytes) bytes = await this.api.readBlob(item.sha);
      if (!this.historyOpen || request !== this.previewRequest) return;
      this.detail.empty();
      this.detail.createEl("h4", { text: revision.message + " \xB7 " + revision.sha.slice(0, 12) });
      if (bytes) {
        const text = new TextDecoder().decode(bytes);
        this.detail.createEl("pre", { text: text.slice(0, 24e3) + (text.length > 24e3 ? "\n\u2026" : "") });
      } else this.detail.createEl("p", { text: t(
        "This revision is too large to preview. The copy will include the entire file.",
        "\u6B64\u7248\u672C\u8F83\u5927\uFF0C\u6062\u590D\u7684\u526F\u672C\u4F1A\u5305\u542B\u5B8C\u6574\u6587\u4EF6\u3002"
      ) });
      new import_obsidian2.Setting(this.detail).setDesc(t("Create a separate file beside the current note.", "\u5728\u5F53\u524D\u7B14\u8BB0\u65C1\u65B0\u5EFA\u4E00\u4EFD\u526F\u672C\u3002")).addButton((button) => button.setButtonText(t("Restore as a copy", "\u6062\u590D\u4E3A\u526F\u672C")).setCta().onClick(async () => {
        button.setDisabled(true);
        try {
          const data = bytes || await this.api.readBlob(item.sha);
          if (!this.historyOpen || request !== this.previewRequest) return;
          const copy = await restoreCopy(this.app.vault, this.path, revision.sha, data);
          if (!this.historyOpen) return;
          this.close();
          new import_obsidian2.Notice(t("Restored copy: ", "\u5DF2\u6062\u590D\u526F\u672C ") + copy.path);
          await this.app.workspace.getLeaf("tab").openFile(copy);
        } catch (error) {
          if (this.historyOpen) {
            button.setDisabled(false);
            new import_obsidian2.Notice(error.message, 8e3);
          }
        }
      }));
      this.detail.scrollIntoView({ block: "nearest" });
    } catch (error) {
      if (this.historyOpen && request === this.previewRequest) this.detail.setText(error.message);
    }
  }
  onClose() {
    this.historyOpen = false;
    this.previewRequest++;
    this.contentEl.empty();
  }
};

// src/engine.js
var import_ignore = __toESM(require_ignore(), 1);

// src/target.js
function repositoryName(value) {
  let name = value.trim();
  if (name.startsWith("https://github.com/")) {
    name = name.slice("https://github.com/".length).replace(/\/$/, "").replace(/\.git$/, "");
  }
  const parts = name.split("/");
  if (parts.length !== 2 || !/^[\w-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1]) || [".", ".."].includes(parts[1])) {
    throw new Error("Enter a GitHub repository as owner/name.");
  }
  return parts.join("/");
}
function branchName(value) {
  const branch = value.trim();
  if (!branch || branch === "@" || branch === "HEAD" || branch.startsWith("-") || branch.endsWith(".") || /[\x00-\x20\x7f~^:?*[\]\\]/.test(branch) || branch.includes("@{") || branch.includes("..") || branch.split("/").some((part) => !part || part.startsWith(".") || part.endsWith(".lock"))) {
    throw new Error("Enter a valid Git branch name.");
  }
  return branch;
}
function sameTarget(left, right) {
  return left?.repository?.toLowerCase() === right?.repository?.toLowerCase() && left?.branch === right?.branch;
}
var portableSettings = /* @__PURE__ */ new Set([
  "app.json",
  "appearance.json",
  "backlink.json",
  "bookmarks.json",
  "daily-notes.json",
  "graph.json",
  "hotkeys.json",
  "templates.json",
  "types.json"
]);
function fileScope(settings = false, configDir = ".obsidian") {
  function allowed(path, folder = false) {
    if (typeof path !== "string" || !path || /[\\\x00-\x1f\x7f]/.test(path) || /^[A-Za-z]:/.test(path)) return false;
    const parts = path.split("/");
    if (parts.some((p) => !p || p === "." || p === "..")) return false;
    if (parts[0] !== configDir) return !parts.some((p) => p.startsWith("."));
    if (!settings || parts.slice(1).some((p) => p.startsWith("."))) return false;
    if (parts.length === 1) return folder;
    if (parts.length === 2 && portableSettings.has(parts[1])) return !folder;
    if (parts[1] === "snippets") return folder ? parts.length === 2 : parts.length === 3 && path.endsWith(".css");
    if (parts[1] === "themes") return folder ? parts.length <= 3 : parts.length === 4 && ["manifest.json", "theme.css", "LICENSE"].includes(parts[3]);
    return false;
  }
  return { settings, configDir, allowed };
}

// node_modules/node-diff3/dist/js/diff3.mjs
function LCS(buffer1, buffer2) {
  let prefixEnd = { buffer1index: -1, buffer2index: -1, chain: null };
  const maxPrefix = Math.min(buffer1.length, buffer2.length);
  for (let p = 0; p < maxPrefix && buffer1[p] === buffer2[p]; p++) {
    prefixEnd = { buffer1index: p, buffer2index: p, chain: prefixEnd };
  }
  const prefixLength = prefixEnd.buffer1index + 1;
  const SMALL_CLASS = 16;
  const equivalenceClasses = /* @__PURE__ */ new Map();
  const largeClasses = [];
  for (let j = prefixLength; j < buffer2.length; j++) {
    const item = buffer2[j];
    const indices = equivalenceClasses.get(item);
    if (indices) {
      indices.push(j);
      if (indices.length === SMALL_CLASS + 1) {
        largeClasses.push(indices);
      }
    } else {
      equivalenceClasses.set(item, [j]);
    }
  }
  const taken = new Uint8Array(buffer2.length);
  const slotOf = new Int32Array(buffer2.length).fill(-1);
  const slotStart = /* @__PURE__ */ new Map();
  let slotCount = 0;
  for (const indices of largeClasses) {
    slotStart.set(indices, slotCount);
    for (let k = 0; k < indices.length; k++) {
      slotOf[indices[k]] = slotCount + k;
    }
    slotCount += indices.length;
  }
  let size = 1;
  while (size < slotCount)
    size <<= 1;
  const free = new Int32Array(2 * size);
  free.fill(1, size, size + slotCount);
  for (let k = size - 1; k > 0; k--) {
    free[k] = free[2 * k] + free[2 * k + 1];
  }
  function nextFreeSlot(slot) {
    if (slot >= slotCount)
      return -1;
    let k = slot + size;
    while (free[k] === 0) {
      while (k & 1)
        k >>= 1;
      if (k === 0)
        return -1;
      k++;
    }
    while (k < size) {
      k = free[2 * k] ? 2 * k : 2 * k + 1;
    }
    return k - size;
  }
  function setTaken(j, isTaken) {
    taken[j] = isTaken ? 1 : 0;
    const slot = slotOf[j];
    if (slot < 0)
      return;
    const delta = isTaken ? -1 : 1;
    for (let k = slot + size; k > 0; k >>= 1) {
      free[k] += delta;
    }
  }
  function setCandidate(r, c) {
    const old = candidates[r];
    if (old === c)
      return;
    if (old)
      setTaken(old.buffer2index, false);
    setTaken(c.buffer2index, true);
    candidates[r] = c;
  }
  const candidates = [prefixEnd];
  for (let i = prefixLength; i < buffer1.length; i++) {
    const item = buffer1[i];
    const indices = equivalenceClasses.get(item);
    if (!indices)
      continue;
    const start = indices.length > SMALL_CLASS ? slotStart.get(indices) : -1;
    let r = 0;
    let c = candidates[0];
    let k = 0;
    while (true) {
      const after = candidates[r].buffer2index;
      let lo = k;
      let hi = indices.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (indices[mid] <= after) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      if (start < 0) {
        while (lo < indices.length && taken[indices[lo]])
          lo++;
        if (lo === indices.length)
          break;
        k = lo;
      } else {
        const slot = nextFreeSlot(start + lo);
        if (slot === -1 || slot >= start + indices.length)
          break;
        k = slot - start;
      }
      const j = indices[k];
      lo = r + 1;
      hi = candidates.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (candidates[mid].buffer2index < j) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      const s = lo - 1;
      const newCandidate = { buffer1index: i, buffer2index: j, chain: candidates[s] };
      setCandidate(r, c);
      r = s + 1;
      c = newCandidate;
      if (r === candidates.length) {
        break;
      }
      k++;
    }
    setCandidate(r, c);
  }
  return candidates[candidates.length - 1];
}
function diffIndices(buffer1, buffer2) {
  const lcs = LCS(buffer1, buffer2);
  const result = [];
  let tail1 = buffer1.length;
  let tail2 = buffer2.length;
  for (let candidate = lcs; candidate !== null; candidate = candidate.chain) {
    const mismatchLength1 = tail1 - candidate.buffer1index - 1;
    const mismatchLength2 = tail2 - candidate.buffer2index - 1;
    tail1 = candidate.buffer1index;
    tail2 = candidate.buffer2index;
    if (mismatchLength1 || mismatchLength2) {
      result.push({
        buffer1: [tail1 + 1, mismatchLength1],
        buffer1Content: buffer1.slice(tail1 + 1, tail1 + 1 + mismatchLength1),
        buffer2: [tail2 + 1, mismatchLength2],
        buffer2Content: buffer2.slice(tail2 + 1, tail2 + 1 + mismatchLength2)
      });
    }
  }
  result.reverse();
  return result;
}

// src/merge.js
function edits(base, side, name) {
  return diffIndices(base, side).map(({ buffer1: [start, count], buffer2Content }) => ({ start, end: start + count, lines: buffer2Content, name }));
}
function applyEdits(base, start, end, changes) {
  const lines = [];
  let cursor = start;
  for (const edit of changes) {
    lines.push(...base.slice(cursor, edit.start), ...edit.lines);
    cursor = edit.end;
  }
  return lines.concat(base.slice(cursor, end));
}
function lineEnding(text) {
  const first = text.match(/\r\n|\r|\n/)?.[0];
  if (!first) return "";
  return /[\r\n]/.test(text.split(first).join("")) ? null : first;
}
function mergeText(baseText, localText, remoteText) {
  const [original, here, there] = [baseText, localText, remoteText].map(lineEnding);
  if ([original, here, there].includes(null)) return null;
  if (here && there && here !== there && here !== original && there !== original) return null;
  const eol = (here === original ? there : here) || there || original || "\n";
  const [base, local, remote] = [baseText, localText, remoteText].map((text) => text.split(/\r\n|\n|\r/));
  if (Math.max(base.length, local.length, remote.length) > 1e4) return null;
  const changes = [...edits(base, local, "local"), ...edits(base, remote, "remote")].sort((a, b) => a.start - b.start || a.end - b.end);
  const parts = [];
  let cursor = 0, overlaps = 0;
  for (let i = 0; i < changes.length; ) {
    const first = changes[i++];
    let end = first.end;
    const group = [first];
    while (i < changes.length && (changes[i].start < end || first.start === end && changes[i].start === end && changes[i].end === end)) {
      const next = changes[i++];
      group.push(next);
      end = Math.max(end, next.end);
    }
    if (cursor < first.start) parts.push({ lines: base.slice(cursor, first.start) });
    const left = group.filter((edit) => edit.name === "local");
    const right = group.filter((edit) => edit.name === "remote");
    const localLines = applyEdits(base, first.start, end, left);
    const remoteLines = applyEdits(base, first.start, end, right);
    if (!left.length || !right.length || localLines.length === remoteLines.length && localLines.every((line, j) => line === remoteLines[j])) {
      parts.push({ lines: left.length ? localLines : remoteLines });
    } else {
      parts.push({
        index: overlaps++,
        line: first.start + 1,
        base: base.slice(first.start, end),
        local: localLines,
        remote: remoteLines
      });
    }
    cursor = end;
  }
  if (cursor < base.length) parts.push({ lines: base.slice(cursor) });
  return { parts, overlaps, eol };
}
function mergeResult(model, sides = []) {
  return model.parts.flatMap((part) => {
    if (part.lines) return part.lines;
    const choice = sides[part.index];
    if (choice !== "local" && choice !== "remote") throw new Error("Choose a version for every overlapping edit.");
    return part[choice];
  }).join(model.eol);
}
async function prepareMerge(change, adapter, api, remoteSize) {
  if (!isMarkdownNote(change.path) || !change.before || !change.here || !change.there || remoteSize > maxPreviewBytes) return null;
  await adapter.flush?.(change.path);
  const stat = await adapter.stat(change.path);
  if (stat?.type !== "file" || stat.size > maxPreviewBytes) return null;
  const bytes = await adapter.readBinary(change.path);
  if (bytes.byteLength > maxPreviewBytes) return null;
  if (await blobOid(bytes) !== change.here) throw new Error("Edited during review. Run sync again: " + change.path);
  const decode = (value) => {
    if (value.byteLength > maxPreviewBytes) return null;
    try {
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(value);
      return text.includes("\0") || isDrawingText(text) ? null : text;
    } catch {
      return null;
    }
  };
  const local = decode(bytes);
  if (local === null) return null;
  let ancestor;
  try {
    ancestor = await api.readBlob(change.before);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const base = decode(ancestor);
  if (base === null) return null;
  const remote = decode(await api.readBlob(change.there));
  if (remote === null) return null;
  const model = mergeText(base, local, remote);
  return model && { ...model, originalLocal: local };
}

// src/engine.js
function fromState(state, target, scope) {
  if (!state || state.version !== 1 || !sameTarget(state, target) || state.settings !== scope.settings || state.configDir !== scope.configDir || !Array.isArray(state.files)) return null;
  if (!state.files.every((pair) => Array.isArray(pair) && pair.length === 2 && scope.allowed(pair[0]) && validOid(pair[1]))) return null;
  return new Map(state.files);
}
function parent(path) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}
function prefixes(paths) {
  const dirs = /* @__PURE__ */ new Set();
  for (const path of paths) {
    for (let dir = parent(path); dir && !dirs.has(dir); dir = parent(dir)) dirs.add(dir);
  }
  return dirs;
}
function scopedRules(sources) {
  const result = /* @__PURE__ */ new Map();
  for (const [file, source] of sources) result.set(parent(file), (0, import_ignore.default)().add(source));
  return (path, isFolder) => {
    let ignored = false;
    const pieces = path.split("/");
    for (let depth = 0; depth < pieces.length; depth++) {
      const set = result.get(pieces.slice(0, depth).join("/"));
      if (!set) continue;
      const match = set.test(pieces.slice(depth).join("/") + (isFolder ? "/" : ""));
      if (match.ignored) ignored = true;
      if (match.unignored) ignored = false;
    }
    return ignored;
  };
}
async function readLocal(adapter, path) {
  try {
    return await adapter.readBinary(path);
  } catch (err) {
    if (!await adapter.exists(path)) throw new Error("A file moved during sync. Run sync again.");
    throw err;
  }
}
async function localManifest(adapter, tracked, ignored, blocked, scope) {
  const files = /* @__PURE__ */ new Map();
  const directories = prefixes(tracked);
  async function visit(dir, localRules) {
    const list = await adapter.list(dir);
    const ownIgnore = (dir ? dir + "/" : "") + ".gitignore";
    if (list.files.includes(ownIgnore)) localRules = new Map([...localRules, [ownIgnore, await adapter.read(ownIgnore)]]);
    const ignoredHere = scopedRules(localRules);
    for (const path of list.files) {
      if (scope.allowed(path) && !blocked.has(path) && (tracked.has(path) || !ignored(path, false) && !ignoredHere(path, false))) {
        files.set(path, await blobOid(await readLocal(adapter, path)));
      }
    }
    for (const path of list.folders) {
      if (scope.allowed(path, true) && !blocked.has(path) && (directories.has(path) || !ignored(path, true) && !ignoredHere(path, true))) await visit(path, localRules);
    }
  }
  await visit("", /* @__PURE__ */ new Map());
  for (const path of tracked) {
    if (files.has(path)) continue;
    const hash = await currentOid(adapter, path);
    if (hash) files.set(path, hash);
  }
  return files;
}
function planChanges(base, local, remote, send) {
  const incoming = [], outgoing = [], conflicts = [];
  const paths = /* @__PURE__ */ new Set([...base.keys(), ...local.keys(), ...remote.keys()]);
  for (const path of paths) {
    const before = base.get(path), here = local.get(path), there = remote.get(path);
    if (here === there) continue;
    const change = { path, before, here, there };
    if (here === before) incoming.push(change);
    else if (there === before) {
      if (send) outgoing.push(change);
    } else conflicts.push(change);
  }
  return { incoming, outgoing, conflicts };
}
function checkNames(paths) {
  const aliases = /* @__PURE__ */ new Map(), leaves = new Set(paths);
  for (const path of leaves) {
    let current = "";
    for (const part of path.split("/")) {
      current += (current ? "/" : "") + part;
      const key = current.normalize("NFC").toLowerCase();
      const other = aliases.get(key);
      if (other && other !== current || current !== path && leaves.has(current)) {
        throw new Error("Conflicting file names or case variants. Rename one before syncing: " + current);
      }
      aliases.set(key, current);
    }
  }
}
async function currentOid(adapter, path) {
  const stat = await adapter.stat(path);
  if (!stat) return void 0;
  if (stat.type !== "file") throw new Error("A folder already exists at this file path: " + path);
  return blobOid(await readLocal(adapter, path));
}
async function mkdirs(adapter, path) {
  const dir = parent(path);
  if (!dir) return;
  const stat = await adapter.stat(dir);
  if (stat?.type === "folder") return;
  if (stat) throw new Error("A file is blocking the folder: " + dir);
  await mkdirs(adapter, dir);
  await adapter.mkdir(dir);
}
function copyPath(path, oid) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dir = parent(path).split("/").map((part) => part.startsWith(".") ? "Config-" + part.slice(1) : part).join("/");
  const index = name.lastIndexOf(".");
  const stem = index > 0 ? name.slice(0, index) : name;
  const ext = index > 0 ? name.slice(index) : "";
  return "Sync conflicts/" + (dir ? dir + "/" : "") + stem + " (local " + oid.slice(0, 10) + ")" + ext;
}
async function saveCopy(adapter, change, remote) {
  if (!change.here) return;
  await adapter.flush?.(change.path);
  const data = await readLocal(adapter, change.path);
  if (await blobOid(data) !== change.here) throw new Error("Edited during sync. Please retry: " + change.path);
  const target = copyPath(change.path, change.here);
  if (remote.has(target) && remote.get(target) !== change.here) throw new Error("A different conflict copy already exists on GitHub: " + target);
  const existing = await currentOid(adapter, target);
  if (existing === change.here) return;
  if (existing) throw new Error("A previous conflict copy has been edited. Rename it before syncing: " + target);
  await mkdirs(adapter, target);
  await adapter.writeBinary(target, data);
  if (await currentOid(adapter, target) !== change.here) throw new Error("Could not verify the local conflict copy: " + target);
}
async function applyRemote(adapter, api, change) {
  const { path, here, there } = change;
  const bytes = there ? await api.readBlob(there) : null;
  await adapter.flush?.(path);
  if (await currentOid(adapter, path) !== here) throw new Error("Local file changed during download. Run sync again: " + path);
  if (bytes) {
    await mkdirs(adapter, path);
    await adapter.writeBinary(path, bytes);
    if (await currentOid(adapter, path) !== there) throw new Error("The file on disk does not match the downloaded revision: " + path);
  } else if (here) {
    await adapter.trashLocal(path);
    if (await adapter.exists(path)) throw new Error("Could not move the file to the vault trash: " + path);
  }
}
var HeadMoved = class extends Error {
};
function setRevision(files, path, sha) {
  if (sha) files.set(path, sha);
  else files.delete(path);
}
async function uploadBytes(adapter, change) {
  await adapter.flush?.(change.path);
  const bytes = await readLocal(adapter, change.path);
  if (await blobOid(bytes) !== change.here) throw new Error("Edited during upload. Run sync again: " + change.path);
  return bytes;
}
async function synchronize({
  adapter,
  api,
  target,
  state,
  scope = fileScope(),
  send = true,
  fastReceive = false,
  save,
  review,
  progress = () => {
  }
}) {
  const previous = fromState(state, target, scope);
  const base = previous || /* @__PURE__ */ new Map();
  const first = !previous;
  const knownHead = fastReceive && !send && previous && state.settled ? state.head : void 0;
  let snapshot = await api.snapshot(knownHead);
  if (snapshot.unchanged) return { first: false, head: snapshot.head, received: 0, sent: 0, copies: 0, deferred: 0, conflicts: 0 };
  const remote = new Map([...snapshot.entries].filter(([path]) => scope.allowed(path)).map(([path, entry]) => [path, entry.sha]));
  for (const path of base.keys()) {
    if ([...snapshot.blocked].some((root) => path === root || path.startsWith(root + "/"))) base.delete(path);
  }
  const tracked = /* @__PURE__ */ new Set([...base.keys(), ...remote.keys()]);
  progress("Comparing local files\u2026");
  await adapter.flush?.();
  const local = await localManifest(adapter, tracked, scopedRules(snapshot.rules), snapshot.blocked, scope);
  checkNames(/* @__PURE__ */ new Set([...local.keys(), ...remote.keys()]));
  const plan = planChanges(base, local, remote, true);
  const canSend = send && !first;
  const merges = /* @__PURE__ */ new Map();
  for (const change of plan.conflicts) {
    const model = await prepareMerge(change, adapter, api, snapshot.entries.get(change.path)?.size);
    if (model) merges.set(change.path, model);
  }
  let decision = { selected: /* @__PURE__ */ new Set(), conflicts: /* @__PURE__ */ new Map() };
  if (plan.conflicts.some((change) => canSend || merges.get(change.path)?.overlaps !== 0) || canSend && (plan.incoming.length || plan.outgoing.length)) {
    decision = await review({
      incoming: plan.incoming,
      outgoing: canSend ? plan.outgoing : [],
      conflicts: plan.conflicts,
      merges,
      canSend,
      remoteSize: (path) => snapshot.entries.get(path)?.size
    });
    if (!decision) return { canceled: true };
  }
  if ((plan.conflicts.length || canSend && (plan.incoming.length || plan.outgoing.length)) && await api.head() !== snapshot.head) throw new HeadMoved("The remote branch changed during review.");
  const outgoing = canSend ? plan.outgoing.filter((change) => decision.selected.has(change.path)) : [];
  let pending = plan.outgoing.length - outgoing.length;
  const inbound = [...plan.incoming], keepBoth = [], intended = new Map(remote);
  let deferred = 0, merged = 0;
  for (const change of plan.conflicts) {
    const model = merges.get(change.path);
    const choice = decision.conflicts.get(change.path) ?? (model?.overlaps === 0 ? { kind: "merge" } : "later");
    if (choice?.kind === "merge" && model && (!choice.send || canSend)) {
      const text = mergeResult(model, choice.sides);
      const data = new TextEncoder().encode(text).buffer;
      const sha = await blobOid(data);
      inbound.push({ ...change, merge: { text, data, sha, original: model.originalLocal } });
      if (sha !== change.there) {
        if (choice.send) outgoing.push({ ...change, here: sha });
        else pending++;
      }
      merged++;
    } else if (choice === "later") {
      setRevision(intended, change.path, change.before);
      deferred++;
    } else if (choice === "local" && canSend) {
      setRevision(intended, change.path, change.before);
      outgoing.push(change);
    } else if (choice === "keep-local" && !canSend) {
      pending++;
    } else if (choice === "remote" || choice === "both") {
      if (choice === "both" && change.here) keepBoth.push(change);
      inbound.push(change);
    } else {
      throw new Error("Invalid conflict decision for " + change.path);
    }
  }
  for (const change of keepBoth) await saveCopy(adapter, change, remote);
  let received = 0;
  const acknowledged = previous && new Map(previous);
  try {
    for (const change of inbound) {
      progress("Receiving " + (received + 1) + "/" + inbound.length + " \xB7 " + change.path);
      if (change.merge) {
        await adapter.flush?.(change.path);
        const { text, data, sha, original } = change.merge;
        if (adapter.mergeText) await adapter.mergeText(change.path, original, text);
        else {
          if (await currentOid(adapter, change.path) !== change.here) throw new Error("Edited during merge: " + change.path);
          await adapter.writeBinary(change.path, data);
        }
        if (await currentOid(adapter, change.path) !== sha) throw new Error("Merged text changed before verification: " + change.path);
      } else await applyRemote(adapter, api, change);
      if (acknowledged) setRevision(acknowledged, change.path, change.there);
      received++;
    }
  } finally {
    if (acknowledged && received) await save({ ...state, settled: false, files: [...acknowledged] });
  }
  const baseline = (head2, files, settled) => ({
    version: 1,
    ...target,
    settings: scope.settings,
    configDir: scope.configDir,
    head: head2,
    files: [...files],
    settled
  });
  let head = snapshot.head;
  const sent = outgoing.length;
  if (sent && !head) {
    const index = outgoing.findIndex((change) => change.here);
    if (index < 0) throw new Error("The empty branch has no file to commit.");
    const [initial] = outgoing.splice(index, 1);
    head = await api.initialize(initial.path, await uploadBytes(adapter, initial), initial.here);
    intended.set(initial.path, initial.here);
    await save(baseline(head, intended, false));
    if (outgoing.length) {
      snapshot = await api.snapshot();
      if (snapshot.head !== head) throw new HeadMoved("The branch changed after its first commit.");
    }
  }
  if (outgoing.length) {
    const changes = [];
    for (const change of outgoing) {
      const { path, here } = change;
      progress("Preparing commit \xB7 " + path);
      if (here) {
        await api.putBlob(await uploadBytes(adapter, change), here);
      } else {
        await adapter.flush?.(path);
        if (await currentOid(adapter, path)) throw new Error("The deleted file reappeared. Run sync again: " + path);
      }
      setRevision(intended, path, here);
      changes.push({ path, mode: snapshot.entries.get(path)?.mode || "100644", type: "blob", sha: here || null });
    }
    head = await api.commit(snapshot, changes);
  } else if (await api.head() !== head) {
    throw new HeadMoved("The remote branch changed.");
  }
  await save(baseline(head, intended, deferred === 0));
  return { first, head, received, sent, pending, merged, copies: keepBoth.length, deferred, conflicts: plan.conflicts.length };
}

// src/github.js
var host = "https://api.github.com";
var moveRef = "mutation UpdateBranch($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }";
var encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");
function checkedOid(value) {
  if (!validOid(value)) throw new Error("GitHub returned an invalid Git object identifier.");
  return value;
}
var GitHubError = class extends Error {
  constructor(status) {
    const messages = {
      401: "GitHub rejected the token. Reconnect in the plugin settings.",
      403: "GitHub refused the request. Check the token's Contents permission, branch rules and API rate limit.",
      404: "Repository, branch or file not found. Check the repository name and the token's access.",
      409: "The GitHub repository or branch has changed. Sync again.",
      413: "GitHub rejected a file because of its size.",
      422: "GitHub rejected the proposed change. Check the branch rules and file size.",
      429: "GitHub is rate-limiting requests. Try again later."
    };
    super(messages[status] || "GitHub request failed (HTTP " + status + ").");
    this.status = status;
  }
};
var GitHub = class {
  constructor({ repository, branch }, token, request, base64, scope = fileScope()) {
    this.name = repositoryName(repository);
    this.branch = branch ? branchName(branch) : "";
    this.root = "/repos/" + encodePath(this.name);
    this.token = token;
    this.request = request;
    this.base64 = base64;
    this.scope = scope;
  }
  async call(path, method = "GET", body, binary = false) {
    const response = await this.request({
      url: host + path,
      method,
      throw: false,
      headers: {
        Authorization: "Bearer " + this.token,
        Accept: binary ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...body ? { "Content-Type": "application/json" } : {}
      },
      ...body ? { body: JSON.stringify(body) } : {}
    });
    if (response.status < 200 || response.status >= 300) throw new GitHubError(response.status);
    return binary ? response.arrayBuffer : response.json;
  }
  async repository() {
    const info = await this.call(this.root);
    if (info.private !== true || info.full_name?.toLowerCase() !== this.name.toLowerCase() || !info.node_id) {
      throw new Error("Choose a private GitHub repository that you own or can access.");
    }
    this.defaultBranch = branchName(info.default_branch);
    this.branch ||= this.defaultBranch;
    return info;
  }
  async head() {
    try {
      const ref = await this.call(this.root + "/git/ref/heads/" + encodePath(this.branch));
      if (ref.ref !== "refs/heads/" + this.branch) throw new Error("The response names a different Git branch.");
      return checkedOid(ref.object?.sha);
    } catch (error) {
      if (![404, 409].includes(error.status)) throw error;
      const branches = await this.call(this.root + "/branches?per_page=1");
      if (Array.isArray(branches) && !branches.length && this.branch === this.defaultBranch) return null;
      throw new Error("Branch not found. Select an existing branch, or the default branch of a new repository.");
    }
  }
  async readBlob(sha) {
    const bytes = await this.call(this.root + "/git/blobs/" + checkedOid(sha), "GET", void 0, true);
    if (await blobOid(bytes) !== sha) throw new Error("The downloaded file failed Git's integrity check.");
    return bytes;
  }
  async noteHistory(path, head, page = 1) {
    if (!this.scope.allowed(path) || !Number.isSafeInteger(page) || page < 1) throw new Error("Invalid note history request.");
    const query = new URLSearchParams({ sha: checkedOid(head), path, per_page: "20", page: String(page) });
    const rows = await this.call(this.root + "/commits?" + query);
    return rows.map((row) => ({
      sha: checkedOid(row.sha),
      message: row.commit.message.split("\n")[0],
      date: row.commit.author?.date || row.commit.committer?.date || ""
    }));
  }
  async noteRevision(path, commit) {
    if (!this.scope.allowed(path)) throw new Error("This path is outside the sync scope.");
    let item;
    try {
      item = await this.call(this.root + "/contents/" + encodePath(path) + "?ref=" + checkedOid(commit));
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
    if (item.type !== "file" || item.path !== path || item.submodule_git_url || item.target) {
      throw new Error("This revision is not a regular file.");
    }
    return { sha: checkedOid(item.sha), size: item.size };
  }
  async allEntries(tree) {
    const answer = await this.call(this.root + "/git/trees/" + tree + "?recursive=1");
    if (!answer.truncated) return answer.tree;
    const result = [];
    const visit = async (id, prefix) => {
      const level = await this.call(this.root + "/git/trees/" + checkedOid(id));
      if (level.truncated) throw new Error("GitHub could not return the complete directory listing.");
      for (const item of level.tree) {
        const path = prefix + item.path;
        if (item.type === "tree") {
          if (this.scope.allowed(path, true)) await visit(item.sha, path + "/");
        } else result.push({ ...item, path });
      }
    };
    await visit(tree, "");
    return result;
  }
  async snapshot(knownHead) {
    const info = await this.repository();
    const head = await this.head();
    if (head && head === knownHead) return { head, unchanged: true };
    const entries = /* @__PURE__ */ new Map(), rules = /* @__PURE__ */ new Map(), blocked = /* @__PURE__ */ new Set();
    let tree = null;
    if (head) {
      const commit = await this.call(this.root + "/git/commits/" + head);
      tree = checkedOid(commit.tree?.sha);
      for (const item of await this.allEntries(tree)) {
        const { path, type, mode } = item;
        if (type === "tree") continue;
        if (type === "blob" && mode === "100644" && (path === ".gitignore" || path.endsWith("/.gitignore") && this.scope.allowed(path.slice(0, -11), true))) {
          rules.set(path, new TextDecoder().decode(await this.readBlob(item.sha)));
        }
        if (!this.scope.allowed(path) && !this.scope.allowed(path, true)) continue;
        if (type !== "blob" || !["100644", "100755"].includes(mode)) blocked.add(path);
        else if (this.scope.allowed(path)) entries.set(path, { mode, sha: checkedOid(item.sha), size: item.size });
      }
    }
    return { head, tree, entries, rules, blocked, node: info.node_id };
  }
  encoded(bytes) {
    if (bytes.byteLength > 100 * 1024 * 1024) throw new Error("A file exceeds GitHub's 100 MiB blob limit.");
    return this.base64(bytes);
  }
  async initialize(path, bytes, expected) {
    if (await this.head()) throw new HeadMoved("The branch already has a first commit.");
    try {
      const result = await this.call(this.root + "/contents/" + encodePath(path), "PUT", {
        branch: this.branch,
        message: "Add " + path,
        content: this.encoded(bytes)
      });
      if (result.content?.sha !== expected) throw new Error("The first uploaded file failed its integrity check.");
      return checkedOid(result.commit?.sha);
    } catch (error) {
      if ([409, 422].includes(error.status) && await this.head()) throw new HeadMoved("The branch changed.");
      throw error;
    }
  }
  async putBlob(bytes, expected) {
    const result = await this.call(this.root + "/git/blobs", "POST", { content: this.encoded(bytes), encoding: "base64" });
    if (result.sha !== expected) throw new Error("The uploaded file failed its integrity check.");
  }
  async commit(snapshot, changes) {
    const tree = await this.call(this.root + "/git/trees", "POST", { base_tree: snapshot.tree, tree: changes });
    const commit = await this.call(this.root + "/git/commits", "POST", {
      message: "Sync vault files",
      tree: checkedOid(tree.sha),
      parents: [snapshot.head]
    });
    const after = checkedOid(commit.sha);
    const result = await this.call("/graphql", "POST", { query: moveRef, variables: { input: {
      repositoryId: snapshot.node,
      refUpdates: [{ name: "refs/heads/" + this.branch, beforeOid: snapshot.head, afterOid: after, force: false }]
    } } });
    if (!result.data?.updateRefs || result.errors?.length) {
      if (await this.head() !== snapshot.head) throw new HeadMoved("Another device pushed first.");
      throw new Error("GitHub could not update the branch. Check its rules and the token's Contents write permission.");
    }
    return after;
  }
};

// src/plugin.js
var connectionKey = "vault-branch-sync.connection.v1";
var baselineKey = "vault-branch-sync.baseline.v1";
var autoKey = "vault-branch-sync.auto-receive";
var statusKey = "vault-branch-sync.last-sync";
var tokenPage = "https://github.com/settings/personal-access-tokens/new?name=Vault%20Branch%20Sync&contents=write";
function vaultFiles(app, scope) {
  const vault = app.vault, disk = vault.adapter;
  const isConfig = (path) => path === scope.configDir || path.startsWith(scope.configDir + "/");
  return {
    async list(dir) {
      if (isConfig(dir)) return disk.list(dir);
      const folder = dir ? vault.getFolderByPath(dir) : vault.getRoot();
      const files = [], folders = [];
      for (const item of folder?.children || []) (item instanceof import_obsidian3.TFolder ? folders : files).push(item.path);
      const rule = (dir ? dir + "/" : "") + ".gitignore";
      if (await disk.exists(rule)) files.push(rule);
      if (!dir && scope.settings && !folders.includes(scope.configDir) && await disk.exists(scope.configDir)) folders.push(scope.configDir);
      return { files, folders };
    },
    stat: (path) => disk.stat(path),
    exists: (path) => disk.exists(path),
    read: (path) => disk.read(path),
    readBinary: (path) => disk.readBinary(path),
    async mergeText(path, original, merged) {
      const file = vault.getFileByPath(path);
      if (!file) throw new Error("Moved during merge: " + path);
      await vault.process(file, (current) => {
        if (current !== original) throw new Error("Edited during merge: " + path);
        return merged;
      });
    },
    async flush(path) {
      const view = app.workspace.getActiveViewOfType(import_obsidian3.TextFileView);
      if (view?.file && (!path || view.file.path === path)) await view.save(false);
    },
    mkdir: (path) => isConfig(path) ? disk.mkdir(path) : vault.createFolder(path),
    writeBinary(path, bytes) {
      if (isConfig(path)) return disk.writeBinary(path, bytes);
      const file = vault.getFileByPath(path);
      if (file) return vault.modifyBinary(file, bytes);
      return vault.createBinary(path, bytes);
    },
    trashLocal(path) {
      const file = vault.getFileByPath(path);
      return file ? vault.trash(file, false) : disk.trashLocal(path);
    }
  };
}
var Settings = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const el = this.containerEl, plugin = this.plugin, current = plugin.connection();
    el.empty();
    let repoInput, branchInput, tokenInput, share = current?.settings ?? false;
    new import_obsidian3.Setting(el).setName(t("Private GitHub repository", "GitHub \u79C1\u6709\u4ED3\u5E93")).setDesc(t("Use a repository for your vault. Enter owner/name or its GitHub URL.", "\u586B\u5199\u7B14\u8BB0\u4ED3\u5E93\u7684 owner/name \u6216 GitHub \u5730\u5740\u3002")).addText((input) => {
      repoInput = input;
      input.setPlaceholder("owner/my-notes").setValue(current?.repository || "");
    });
    new import_obsidian3.Setting(el).setName(t("Branch", "\u5206\u652F")).setDesc(t("Leave blank to use the repository's default branch.", "\u7559\u7A7A\u65F6\u4F7F\u7528\u4ED3\u5E93\u9ED8\u8BA4\u5206\u652F\u3002")).addText((input) => {
      branchInput = input;
      input.setPlaceholder(t("Default branch", "\u9ED8\u8BA4\u5206\u652F")).setValue(current?.branch || "");
    });
    const desc = el.ownerDocument.createDocumentFragment();
    desc.appendText(t("Choose only your vault repository and grant Contents read and write. ", "\u53EA\u9009\u62E9\u81EA\u5DF1\u7684\u7B14\u8BB0\u4ED3\u5E93\uFF0C\u6388\u4E88 Contents \u8BFB\u5199\u6743\u9650\u3002"));
    desc.createEl("a", { text: t("Create a fine-grained token on GitHub", "\u5230 GitHub \u521B\u5EFA\u7EC6\u7C92\u5EA6\u4EE4\u724C"), href: tokenPage });
    new import_obsidian3.Setting(el).setName(t("GitHub token", "GitHub \u4EE4\u724C")).setDesc(desc).addText((input) => {
      tokenInput = input;
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "off";
      input.inputEl.spellcheck = false;
      input.setPlaceholder(current ? t("Saved on this device", "\u672C\u8BBE\u5907\u5DF2\u4FDD\u5B58") : t("Paste token", "\u7C98\u8D34\u4EE4\u724C"));
    });
    new import_obsidian3.Setting(el).setName(t("Include settings and themes", "\u540C\u6B65\u5E38\u7528\u8BBE\u7F6E\u4E0E\u4E3B\u9898")).setDesc(t(
      "Also sync appearance, hotkeys, themes and CSS snippets in this vault's configuration folder. Close and reopen the vault to apply downloaded appearance changes.",
      "\u540C\u65F6\u540C\u6B65\u5916\u89C2\u3001\u5FEB\u6377\u952E\u3001\u4E3B\u9898\u548C CSS \u7247\u6BB5\u3002\u63A5\u6536\u540E\u91CD\u65B0\u6253\u5F00\u5E93\u5373\u53EF\u52A0\u8F7D\u5916\u89C2\u3002"
    )).addToggle((toggle) => toggle.setValue(share).onChange((value) => {
      share = value;
    }));
    new import_obsidian3.Setting(el).setName(t("Connect this device", "\u8FDE\u63A5\u672C\u8BBE\u5907")).setDesc(t(
      "A new connection starts with a download. Later you can choose which files to commit.",
      "\u65B0\u8FDE\u63A5\u9996\u6B21\u53EA\u63A5\u6536\uFF0C\u4E4B\u540E\u53EF\u4EE5\u9009\u62E9\u8981\u63D0\u4EA4\u7684\u6587\u4EF6\u3002"
    )).addButton((button) => button.setButtonText(t("Save connection", "\u4FDD\u5B58\u8FDE\u63A5")).setCta().onClick(async () => {
      if (plugin.busy) return;
      button.setDisabled(true);
      try {
        await plugin.connect(repoInput.getValue(), branchInput.getValue(), tokenInput.getValue(), share);
        tokenInput.setValue("");
        this.display();
        new import_obsidian3.Notice(t("Connected. Use Receive changes to download this branch.", "\u5DF2\u8FDE\u63A5\u3002\u70B9\u300C\u4EC5\u63A5\u6536\u300D\u4E0B\u8F7D\u8FD9\u4E2A\u5206\u652F\u3002"));
      } catch (error) {
        new import_obsidian3.Notice(error.message, 1e4);
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian3.Setting(el).setName(t("Receive when opening or returning to this vault", "\u6253\u5F00\u7B14\u8BB0\u5E93\u6216\u56DE\u5230\u524D\u53F0\u65F6\u81EA\u52A8\u63A5\u6536")).setDesc(t(
      "On this device, download GitHub changes and leave conflicts for review. Uploads are always manual.",
      "\u6B64\u8BBE\u5907\u4F1A\u81EA\u52A8\u63A5\u6536 GitHub \u66F4\u65B0\uFF0C\u9047\u5230\u51B2\u7A81\u7559\u5F85\u4F60\u9009\u62E9\u3002\u4E0A\u4F20\u4ECD\u7531\u4F60\u624B\u52A8\u53D1\u8D77\u3002"
    )).addToggle((toggle) => toggle.setValue(plugin.autoEnabled()).onChange((value) => {
      this.app.saveLocalStorage(autoKey, value);
      plugin.scheduleReceive();
    }));
    this.statusSetting = new import_obsidian3.Setting(el).setName(t("Sync status on this device", "\u672C\u8BBE\u5907\u540C\u6B65\u72B6\u6001"));
    plugin.refreshStatus();
    new import_obsidian3.Setting(el).setName(t("Sync vault", "\u540C\u6B65\u7B14\u8BB0")).setDesc(t("Review incoming changes and choose the local files to commit together.", "\u9884\u89C8\u5F85\u63A5\u6536\u7684\u6539\u52A8\uFF0C\u5E76\u52FE\u9009\u672C\u6B21\u4E00\u8D77\u63D0\u4EA4\u7684\u6587\u4EF6\u3002")).addButton((b) => b.setButtonText(t("Review changes", "\u9884\u89C8\u540C\u6B65\u6539\u52A8")).onClick(() => plugin.run(true))).addButton((b) => b.setButtonText(t("Receive changes", "\u4EC5\u63A5\u6536")).onClick(() => plugin.run(false)));
  }
  hide() {
    this.statusSetting = null;
  }
};
var VaultBranchSync = class extends import_obsidian3.Plugin {
  onload() {
    this.busy = false;
    this.active = true;
    this.ready = false;
    this.settingsTab = new Settings(this.app, this);
    this.addSettingTab(this.settingsTab);
    if (!import_obsidian3.Platform.isMobile) this.statusBar = this.addStatusBarItem();
    this.refreshStatus();
    this.addRibbonIcon("refresh-cw", t("Sync vault with GitHub", "\u540C\u6B65\u7B14\u8BB0\u5230 GitHub"), () => this.run(true));
    this.addCommand({ id: "sync", name: t("Sync with GitHub", "\u4E0E GitHub \u540C\u6B65"), callback: () => this.run(true) });
    this.addCommand({ id: "receive", name: t("Receive changes from GitHub", "\u4EC5\u63A5\u6536 GitHub \u66F4\u65B0"), callback: () => this.run(false) });
    this.addCommand({ id: "show-status", name: t("Show sync status", "\u67E5\u770B\u540C\u6B65\u72B6\u6001"), callback: () => new import_obsidian3.Notice(this.statusText(), 8e3) });
    const historyTitle = t("View note history on GitHub", "\u67E5\u770B\u672C\u7BC7 GitHub \u5386\u53F2");
    this.addCommand({ id: "note-history", name: historyTitle, checkCallback: (checking) => {
      const file = this.app.workspace.getActiveFile();
      if (!file || !isMarkdownNote(file.path)) return false;
      if (!checking) this.openHistory(file);
      return true;
    } });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file.extension && isMarkdownNote(file.path)) menu.addItem((item) => item.setTitle(historyTitle).setIcon("history").onClick(() => this.openHistory(file)));
    }));
    this.app.workspace.onLayoutReady(() => {
      if (!this.active) return;
      this.doc = this.app.workspace.containerEl.ownerDocument;
      this.win = this.doc.defaultView;
      this.ready = true;
      this.registerDomEvent(this.doc, "visibilitychange", () => this.scheduleReceive());
      this.registerDomEvent(this.win, "focus", () => this.scheduleReceive());
      this.scheduleReceive();
    });
  }
  onunload() {
    this.active = false;
    this.win?.clearTimeout(this.autoTimer);
    this.reviewModal?.close();
    this.historyModal?.close();
  }
  autoEnabled() {
    return this.app.loadLocalStorage(autoKey) === true;
  }
  scheduleReceive() {
    if (!this.ready || !this.active) return;
    this.win.clearTimeout(this.autoTimer);
    if (this.doc.hidden || this.busy || !this.autoEnabled() || !this.connection()) return;
    this.autoTimer = this.win.setTimeout(() => {
      if (this.active && !this.doc.hidden && !this.busy && this.autoEnabled()) void this.run(false, true);
    }, 300);
  }
  statusText() {
    const status = this.app.loadLocalStorage(statusKey);
    let text = status?.lastSuccess ? t("Last successful sync", "\u4E0A\u6B21\u6210\u529F\u540C\u6B65") + " \xB7 " + new Date(status.lastSuccess).toLocaleString((0, import_obsidian3.getLanguage)()) : t("No successful sync on this device yet.", "\u672C\u8BBE\u5907\u8FD8\u6CA1\u6709\u6210\u529F\u540C\u6B65\u8BB0\u5F55\u3002");
    if (status) {
      text += t(" | Last check: received ", " | \u4E0A\u6B21\u68C0\u67E5\u63A5\u6536 ") + status.received + t(", committed ", "\uFF0C\u63D0\u4EA4 ") + status.sent;
      if (status.deferred) text += t(", conflicts to review ", "\uFF0C\u5F85\u5904\u7406\u51B2\u7A81 ") + status.deferred;
      if (status.merged) text += t(", merged ", "\uFF0C\u5DF2\u5408\u5E76 ") + status.merged;
    }
    if (this.lastError) text += " | " + this.lastError;
    return text;
  }
  refreshStatus() {
    const text = this.statusText();
    this.settingsTab?.statusSetting?.setDesc(text);
    if (this.statusBar) {
      const status = this.app.loadLocalStorage(statusKey);
      const time = status?.lastSuccess ? new Date(status.lastSuccess).toLocaleTimeString((0, import_obsidian3.getLanguage)(), { hour: "2-digit", minute: "2-digit" }) : "\u2014";
      this.statusBar.setText(this.connection() ? "GitHub \xB7 " + time + (status?.deferred || this.lastError ? " \u26A0" : "") : "");
      this.statusBar.setAttribute("aria-label", text);
      this.statusBar.title = text;
    }
  }
  connection() {
    return this.app.loadLocalStorage(connectionKey);
  }
  openHistory(file) {
    const target = this.connection();
    const token = target && this.app.secretStorage.getSecret(target.secretId);
    if (!token) {
      new import_obsidian3.Notice(t("Connect this device in Settings \u2192 Vault Branch Sync first.", "\u8BF7\u5148\u5230\u300C\u8BBE\u7F6E \u2192 Vault Branch Sync\u300D\u8FDE\u63A5\u672C\u8BBE\u5907\u3002"));
      return;
    }
    this.historyModal?.close();
    const api = this.client(target, token, fileScope(target.settings, this.app.vault.configDir));
    this.historyModal = new NoteHistory(this.app, file, api);
    this.historyModal.open();
  }
  client(target, token, scope) {
    return new GitHub(target, token, async (options) => {
      try {
        return await (0, import_obsidian3.requestUrl)(options);
      } catch {
        throw new Error(t(
          "Could not reach GitHub. You can keep editing offline and retry later.",
          "\u6682\u65F6\u8FDE\u4E0D\u4E0A GitHub\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u79BB\u7EBF\u8BB0\u5F55\uFF0C\u8054\u7F51\u540E\u518D\u6B21\u540C\u6B65\u3002"
        ));
      }
    }, import_obsidian3.arrayBufferToBase64, scope);
  }
  async connect(name, branchValue, tokenValue, settings) {
    this.busy = true;
    try {
      const previous = this.connection(), repository = repositoryName(name);
      const target = { repository, branch: branchValue.trim() ? branchName(branchValue) : "" };
      const sameRepository = previous?.repository?.toLowerCase() === repository.toLowerCase();
      const token = tokenValue.trim() || sameRepository && this.app.secretStorage.getSecret(previous.secretId);
      if (!token) throw new Error(t("A token is required for this repository.", "\u8BF7\u4E3A\u8FD9\u4E2A\u4ED3\u5E93\u586B\u5199\u8BBF\u95EE\u4EE4\u724C\u3002"));
      const client = this.client(target, token, fileScope(settings, this.app.vault.configDir));
      const info = await client.repository();
      await client.head();
      target.repository = info.full_name;
      target.branch = client.branch;
      const secretId = previous?.secretId || "vault-branch-sync-" + crypto.randomUUID();
      this.app.secretStorage.setSecret(secretId, token);
      this.app.saveLocalStorage(connectionKey, { ...target, secretId, settings });
      if (!sameTarget(previous, target) || previous?.settings !== settings) {
        this.app.saveLocalStorage(baselineKey, null);
        this.app.saveLocalStorage(statusKey, null);
      }
      this.lastError = null;
      this.refreshStatus();
    } finally {
      this.busy = false;
    }
    this.scheduleReceive();
  }
  async run(send, automatic = false) {
    if (this.busy || !this.active) {
      if (!automatic && this.active) new import_obsidian3.Notice(t("A sync or connection check is already running.", "\u6B63\u5728\u540C\u6B65\u6216\u68C0\u67E5\u8FDE\u63A5\u3002"));
      return;
    }
    const connection = this.connection();
    if (!connection) {
      if (!automatic) new import_obsidian3.Notice(t(
        "Open Settings \u2192 Vault Branch Sync to connect a private GitHub repository.",
        "\u8BF7\u5148\u5728\u300C\u8BBE\u7F6E \u2192 Vault Branch Sync\u300D\u8FDE\u63A5\u81EA\u5DF1\u7684 GitHub \u79C1\u6709\u4ED3\u5E93\u3002"
      ), 9e3);
      return;
    }
    this.busy = true;
    let notice;
    try {
      const token = this.app.secretStorage.getSecret(connection.secretId);
      if (!token) throw new Error(t("Reconnect in settings to restore this device's token.", "\u8BF7\u5728\u8BBE\u7F6E\u91CC\u91CD\u65B0\u8FDE\u63A5\uFF0C\u4FDD\u5B58\u672C\u8BBE\u5907\u7684\u4EE4\u724C\u3002"));
      const target = { repository: connection.repository, branch: connection.branch };
      const scope = fileScope(connection.settings, this.app.vault.configDir);
      const api = this.client(target, token, scope), adapter = vaultFiles(this.app, scope);
      if (!automatic) notice = new import_obsidian3.Notice(t("Reading branch\u2026", "\u6B63\u5728\u8BFB\u53D6\u5206\u652F\u2026"), 0);
      const review = (plan) => {
        if (!this.active) return null;
        if (automatic) return { selected: /* @__PURE__ */ new Set(), conflicts: /* @__PURE__ */ new Map() };
        const eligible = new Set(plan.outgoing.filter((change) => change.here).map((change) => change.path));
        const { metadataCache, vault } = this.app;
        const meta = (path) => {
          const file = vault.getFileByPath(path);
          return file && metadataCache.getFileCache(file);
        };
        return new Promise((resolve) => {
          this.reviewModal = new SyncReview(
            this.app,
            plan,
            (change) => compareNote(change, adapter, api, plan.remoteSize(change.path)),
            (result) => {
              this.reviewModal = null;
              resolve(result);
            },
            (path) => relatedFigures(
              path,
              eligible,
              meta(path),
              (link, source) => metadataCache.getFirstLinkpathDest((0, import_obsidian3.parseLinktext)(link).path, source)?.path,
              (path2) => /\.excalidraw(?:\.md)?$/i.test(path2) || Boolean(/\.md$/i.test(path2) && meta(path2)?.frontmatter?.["excalidraw-plugin"])
            )
          );
          this.reviewModal.open();
        });
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await synchronize({
            adapter,
            api,
            scope,
            target,
            send: send && !automatic,
            fastReceive: automatic,
            review,
            state: this.app.loadLocalStorage(baselineKey),
            save: (value) => this.app.saveLocalStorage(baselineKey, value),
            progress: (message) => notice?.setMessage(message)
          });
          if (result.canceled) {
            if (this.active && !automatic) new import_obsidian3.Notice(t("Sync canceled.", "\u5DF2\u53D6\u6D88\u540C\u6B65\u3002"));
            return;
          }
          const previous = this.app.loadLocalStorage(statusKey);
          const { received, sent, deferred } = result;
          this.app.saveLocalStorage(statusKey, {
            lastSuccess: deferred ? previous?.lastSuccess ?? null : Date.now(),
            received,
            sent,
            deferred,
            merged: result.merged || 0
          });
          this.lastError = null;
          this.refreshStatus();
          if (this.active && (!automatic || received || deferred && deferred !== previous?.deferred)) {
            let message = result.first ? t("First download complete", "\u9996\u6B21\u63A5\u6536\u5B8C\u6210") : t("Sync finished", "\u540C\u6B65\u5B8C\u6210");
            message += t(" \xB7 Received ", " \xB7 \u63A5\u6536 ") + received + t(", committed ", "\uFF0C\u63D0\u4EA4 ") + sent;
            if (deferred) message += t(" \xB7 Review conflicts: ", " \xB7 \u5F85\u5904\u7406\u51B2\u7A81 ") + deferred;
            if (result.merged) message += t(" \xB7 Merged ", " \xB7 \u5DF2\u5408\u5E76 ") + result.merged;
            if (result.copies) message += t(" \xB7 Local copies in Sync conflicts", " \xB7 \u672C\u673A\u526F\u672C\u5DF2\u5B58\u5165 Sync conflicts");
            new import_obsidian3.Notice(message, 8e3);
          }
          return;
        } catch (error) {
          if (!(error instanceof HeadMoved) || attempt || !this.active) throw error;
          notice?.setMessage(t("Another device pushed. Comparing again\u2026", "\u53E6\u4E00\u53F0\u8BBE\u5907\u521A\u521A\u63A8\u9001\uFF0C\u6B63\u5728\u91CD\u65B0\u6BD4\u8F83\u2026"));
        }
      }
    } catch (error) {
      this.lastError = error.message;
      this.refreshStatus();
      if (this.active && !automatic) new import_obsidian3.Notice(error.message, 1e4);
    } finally {
      notice?.hide();
      this.busy = false;
    }
  }
};
module.exports = module.exports.default;
