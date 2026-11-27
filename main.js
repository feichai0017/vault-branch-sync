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
var import_obsidian = require("obsidian");

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

// src/engine.js
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
    const change = { path, here, there };
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
async function synchronize({
  adapter,
  api,
  target,
  state,
  scope = fileScope(),
  send = true,
  save,
  confirm,
  progress = () => {
  },
  allowInitialize = true
}) {
  const previous = fromState(state, target, scope);
  const base = previous || /* @__PURE__ */ new Map();
  const first = !previous;
  const snapshot = await api.snapshot();
  const remote = new Map([...snapshot.entries].filter(([path]) => scope.allowed(path)).map(([path, entry]) => [path, entry.sha]));
  const blocked = snapshot.blocked;
  for (const path of base.keys()) {
    if ([...blocked].some((root) => path === root || path.startsWith(root + "/"))) base.delete(path);
  }
  const tracked = /* @__PURE__ */ new Set([...base.keys(), ...remote.keys()]);
  progress("Comparing local files\u2026");
  await adapter.flush?.();
  const local = await localManifest(adapter, tracked, scopedRules(snapshot.rules), blocked, scope);
  checkNames(/* @__PURE__ */ new Set([...local.keys(), ...remote.keys()]));
  const plan = planChanges(base, local, remote, send && !first);
  if (plan.conflicts.length && !await confirm(plan.conflicts)) return { canceled: true };
  for (const change of plan.conflicts) await saveCopy(adapter, change, remote);
  const inbound = [...plan.incoming, ...plan.conflicts];
  let received = 0;
  const acknowledged = previous && new Map(previous);
  try {
    for (const change of inbound) {
      progress("Receiving " + (received + 1) + "/" + inbound.length + " \xB7 " + change.path);
      await applyRemote(adapter, api, change);
      if (change.there) acknowledged?.set(change.path, change.there);
      else acknowledged?.delete(change.path);
      received++;
    }
  } finally {
    if (acknowledged && received) await save({ ...state, files: [...acknowledged] });
  }
  const intended = new Map(remote);
  let head = snapshot.head;
  const baseline = (revision, files) => ({
    version: 1,
    ...target,
    settings: scope.settings,
    configDir: scope.configDir,
    head: revision,
    files: [...files]
  });
  if (plan.outgoing.length && !head) {
    if (!allowInitialize) throw new HeadMoved("The branch changed while creating its first commit.");
    const change = plan.outgoing.find((item) => item.here);
    if (!change) throw new Error("The empty branch has no file to commit.");
    await adapter.flush?.(change.path);
    const bytes = await readLocal(adapter, change.path);
    if (await blobOid(bytes) !== change.here) throw new Error("Edited during sync: " + change.path);
    const revision = await api.initialize(change.path, bytes, change.here);
    const saved = baseline(revision, [[change.path, change.here]]);
    await save(saved);
    const rest = await synchronize({ adapter, api, target, state: saved, scope, send, save, confirm, progress, allowInitialize: false });
    return { ...rest, sent: 1 + (rest.sent || 0) };
  }
  if (plan.outgoing.length) {
    const changes = [];
    for (const change of plan.outgoing) {
      const { path, here } = change;
      progress("Preparing commit \xB7 " + path);
      await adapter.flush?.(path);
      if (here) {
        const bytes = await readLocal(adapter, path);
        if (await blobOid(bytes) !== here) throw new Error("Edited during upload. Run sync again: " + path);
        await api.putBlob(bytes, here);
        intended.set(path, here);
      } else {
        if (await currentOid(adapter, path)) throw new Error("The deleted file reappeared. Run sync again: " + path);
        intended.delete(path);
      }
      changes.push({ path, mode: snapshot.entries.get(path)?.mode || "100644", type: "blob", sha: here || null });
    }
    head = await api.commit(snapshot, changes);
  } else if (await api.head() !== head) {
    throw new HeadMoved("The remote branch changed.");
  }
  await save(baseline(head, intended));
  return { first, head, received, sent: plan.outgoing.length, copies: plan.conflicts.filter((c) => c.here).length, conflicts: plan.conflicts.length };
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
  async snapshot() {
    const info = await this.repository();
    const head = await this.head();
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
        else if (this.scope.allowed(path)) entries.set(path, { mode, sha: checkedOid(item.sha) });
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
var tokenPage = "https://github.com/settings/personal-access-tokens/new?name=Vault%20Branch%20Sync&contents=write";
var t = (en, zh) => (0, import_obsidian.getLanguage)().startsWith("zh") ? zh : en;
function vaultFiles(app, scope) {
  const vault = app.vault, disk = vault.adapter;
  const isConfig = (path) => path === scope.configDir || path.startsWith(scope.configDir + "/");
  return {
    async list(dir) {
      if (isConfig(dir)) return disk.list(dir);
      const folder = dir ? vault.getFolderByPath(dir) : vault.getRoot();
      const files = [], folders = [];
      for (const item of folder?.children || []) (item instanceof import_obsidian.TFolder ? folders : files).push(item.path);
      const rule = (dir ? dir + "/" : "") + ".gitignore";
      if (await disk.exists(rule)) files.push(rule);
      if (!dir && scope.settings && !folders.includes(scope.configDir) && await disk.exists(scope.configDir)) folders.push(scope.configDir);
      return { files, folders };
    },
    stat: (path) => disk.stat(path),
    exists: (path) => disk.exists(path),
    read: (path) => disk.read(path),
    readBinary: (path) => disk.readBinary(path),
    async flush(path) {
      const view = app.workspace.getActiveViewOfType(import_obsidian.TextFileView);
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
var Conflicts = class extends import_obsidian.Modal {
  constructor(app, changes, resolve) {
    super(app);
    this.changes = changes;
    this.resolve = resolve;
  }
  onOpen() {
    this.setTitle(t("Keep both versions?", "\u4FDD\u7559\u4E24\u8FB9\u7684\u7248\u672C\uFF1F"));
    this.contentEl.createEl("p", { text: t(
      "The following files changed on both sides. Keep both saves your local version in \u201CSync conflicts\u201D and applies the GitHub version at the original path. A remote deletion moves the original to the vault trash.",
      "\u4EE5\u4E0B\u6587\u4EF6\u5728\u4E24\u8FB9\u90FD\u6709\u6539\u52A8\u3002\u9009\u62E9\u300C\u4FDD\u7559\u4E24\u4EFD\u300D\u4F1A\u628A\u672C\u673A\u7248\u672C\u5B58\u5165\u300CSync conflicts\u300D\uFF0C\u539F\u8DEF\u5F84\u91C7\u7528 GitHub \u7248\u672C\u3002GitHub \u5DF2\u5220\u9664\u7684\u539F\u6587\u4EF6\u4F1A\u79FB\u5165\u672C\u673A\u5E9F\u7EB8\u7BD3\u3002"
    ) });
    const list = this.contentEl.createEl("ul");
    for (const { path } of this.changes) list.createEl("li", { text: path });
    new import_obsidian.Setting(this.contentEl).addButton((button) => button.setButtonText(t("Cancel", "\u53D6\u6D88")).onClick(() => this.close())).addButton((button) => button.setButtonText(t("Keep both", "\u4FDD\u7559\u4E24\u4EFD")).setCta().onClick(() => {
      this.resolve(true);
      this.close();
    }));
  }
  onClose() {
    this.resolve(false);
    this.contentEl.empty();
  }
};
var Settings = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const el = this.containerEl, plugin = this.plugin, current = plugin.connection();
    el.empty();
    let repoInput, branchInput, tokenInput, share = current?.settings ?? false;
    new import_obsidian.Setting(el).setName(t("Private GitHub repository", "GitHub \u79C1\u6709\u4ED3\u5E93")).setDesc(t("Use a repository for your vault. Enter owner/name or its GitHub URL.", "\u586B\u5199\u7B14\u8BB0\u4ED3\u5E93\u7684 owner/name \u6216 GitHub \u5730\u5740\u3002")).addText((input) => {
      repoInput = input;
      input.setPlaceholder("owner/my-notes").setValue(current?.repository || "");
    });
    new import_obsidian.Setting(el).setName(t("Branch", "\u5206\u652F")).setDesc(t("Leave blank to use the repository's default branch.", "\u7559\u7A7A\u65F6\u4F7F\u7528\u4ED3\u5E93\u9ED8\u8BA4\u5206\u652F\u3002")).addText((input) => {
      branchInput = input;
      input.setPlaceholder(t("Default branch", "\u9ED8\u8BA4\u5206\u652F")).setValue(current?.branch || "");
    });
    const desc = document.createDocumentFragment();
    desc.appendText(t("Choose only your vault repository and grant Contents read and write. ", "\u53EA\u9009\u62E9\u81EA\u5DF1\u7684\u7B14\u8BB0\u4ED3\u5E93\uFF0C\u6388\u4E88 Contents \u8BFB\u5199\u6743\u9650\u3002"));
    desc.createEl("a", { text: t("Create a fine-grained token on GitHub", "\u5230 GitHub \u521B\u5EFA\u7EC6\u7C92\u5EA6\u4EE4\u724C"), href: tokenPage });
    new import_obsidian.Setting(el).setName(t("GitHub token", "GitHub \u4EE4\u724C")).setDesc(desc).addText((input) => {
      tokenInput = input;
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "off";
      input.inputEl.spellcheck = false;
      input.setPlaceholder(current ? t("Saved on this device", "\u672C\u8BBE\u5907\u5DF2\u4FDD\u5B58") : t("Paste token", "\u7C98\u8D34\u4EE4\u724C"));
    });
    new import_obsidian.Setting(el).setName(t("Include settings and themes", "\u540C\u6B65\u5E38\u7528\u8BBE\u7F6E\u4E0E\u4E3B\u9898")).setDesc(t(
      "Also sync appearance, hotkeys, themes and CSS snippets in this vault's configuration folder. Close and reopen the vault to apply downloaded appearance changes.",
      "\u540C\u65F6\u540C\u6B65\u5916\u89C2\u3001\u5FEB\u6377\u952E\u3001\u4E3B\u9898\u548C CSS \u7247\u6BB5\u3002\u63A5\u6536\u540E\u91CD\u65B0\u6253\u5F00\u5E93\u5373\u53EF\u52A0\u8F7D\u5916\u89C2\u3002"
    )).addToggle((toggle) => toggle.setValue(share).onChange((value) => {
      share = value;
    }));
    new import_obsidian.Setting(el).setName(t("Connect this device", "\u8FDE\u63A5\u672C\u8BBE\u5907")).setDesc(t(
      "A new repository, branch or file scope starts with a download. After that, Sync can upload existing files in this vault.",
      "\u66F4\u6362\u4ED3\u5E93\u3001\u5206\u652F\u6216\u540C\u6B65\u8303\u56F4\u540E\u9996\u6B21\u53EA\u63A5\u6536\u3002\u4E4B\u540E\u70B9\u51FB\u540C\u6B65\u4F1A\u4E0A\u4F20\u672C\u5E93\u4E2D\u6709\u6539\u52A8\u7684\u6587\u4EF6\u3002"
    )).addButton((button) => button.setButtonText(t("Save connection", "\u4FDD\u5B58\u8FDE\u63A5")).setCta().onClick(async () => {
      if (plugin.busy) return;
      button.setDisabled(true);
      try {
        await plugin.connect(repoInput.getValue(), branchInput.getValue(), tokenInput.getValue(), share);
        tokenInput.setValue("");
        this.display();
        new import_obsidian.Notice(t("Connected. Use Receive changes to download this branch.", "\u5DF2\u8FDE\u63A5\u3002\u70B9\u300C\u4EC5\u63A5\u6536\u300D\u4E0B\u8F7D\u8FD9\u4E2A\u5206\u652F\u3002"));
      } catch (error) {
        new import_obsidian.Notice(error.message, 1e4);
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian.Setting(el).setName(t("Sync vault", "\u540C\u6B65\u7B14\u8BB0")).setDesc(t("Receive remote changes and send local edits in a Git commit.", "\u63A5\u6536\u8FDC\u7AEF\u66F4\u65B0\uFF0C\u5E76\u628A\u672C\u673A\u6539\u52A8\u63D0\u4EA4\u5230 GitHub\u3002")).addButton((b) => b.setButtonText(t("Sync now", "\u7ACB\u5373\u540C\u6B65")).onClick(() => plugin.run(true))).addButton((b) => b.setButtonText(t("Receive changes", "\u4EC5\u63A5\u6536")).onClick(() => plugin.run(false)));
  }
};
var VaultBranchSync = class extends import_obsidian.Plugin {
  onload() {
    this.busy = false;
    this.addSettingTab(new Settings(this.app, this));
    this.addRibbonIcon("refresh-cw", t("Sync vault with GitHub", "\u540C\u6B65\u7B14\u8BB0\u5230 GitHub"), () => this.run(true));
    this.addCommand({ id: "sync", name: t("Sync with GitHub", "\u4E0E GitHub \u540C\u6B65"), callback: () => this.run(true) });
    this.addCommand({ id: "receive", name: t("Receive changes from GitHub", "\u4EC5\u63A5\u6536 GitHub \u66F4\u65B0"), callback: () => this.run(false) });
  }
  connection() {
    return this.app.loadLocalStorage(connectionKey);
  }
  client(target, token, scope) {
    return new GitHub(target, token, async (options) => {
      try {
        return await (0, import_obsidian.requestUrl)(options);
      } catch {
        throw new Error(t(
          "Could not reach GitHub. You can keep editing offline and retry later.",
          "\u6682\u65F6\u8FDE\u4E0D\u4E0A GitHub\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u79BB\u7EBF\u8BB0\u5F55\uFF0C\u8054\u7F51\u540E\u518D\u6B21\u540C\u6B65\u3002"
        ));
      }
    }, import_obsidian.arrayBufferToBase64, scope);
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
      if (!sameTarget(previous, target) || previous?.settings !== settings) this.app.saveLocalStorage(baselineKey, null);
    } finally {
      this.busy = false;
    }
  }
  async run(send) {
    if (this.busy) {
      new import_obsidian.Notice(t("A sync or connection check is already running.", "\u6B63\u5728\u540C\u6B65\u6216\u68C0\u67E5\u8FDE\u63A5\u3002"));
      return;
    }
    const connection = this.connection();
    if (!connection) {
      new import_obsidian.Notice(t(
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
      notice = new import_obsidian.Notice(t("Reading branch\u2026", "\u6B63\u5728\u8BFB\u53D6\u5206\u652F\u2026"), 0);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await synchronize({
            adapter,
            api,
            scope,
            target,
            send,
            state: this.app.loadLocalStorage(baselineKey),
            save: (state) => this.app.saveLocalStorage(baselineKey, state),
            confirm: (changes) => new Promise((resolve) => new Conflicts(this.app, changes, resolve).open()),
            progress: (message) => notice.setMessage(message)
          });
          if (result.canceled) {
            new import_obsidian.Notice(t("Sync canceled.", "\u5DF2\u53D6\u6D88\u540C\u6B65\u3002"));
            return;
          }
          const prefix = result.first ? t("First download complete", "\u9996\u6B21\u63A5\u6536\u5B8C\u6210") : t("Sync complete", "\u540C\u6B65\u5B8C\u6210");
          new import_obsidian.Notice(prefix + t(" \xB7 Received ", " \xB7 \u63A5\u6536 ") + result.received + t(", sent ", "\uFF0C\u63D0\u4EA4 ") + result.sent + (result.copies ? t(". Local copies are in Sync conflicts.", "\u3002\u672C\u5730\u526F\u672C\u5728 Sync conflicts\u3002") : ""), 8e3);
          return;
        } catch (error) {
          if (!(error instanceof HeadMoved) || attempt) throw error;
          notice.setMessage(t("Another device pushed. Comparing again\u2026", "\u53E6\u4E00\u53F0\u8BBE\u5907\u521A\u521A\u63A8\u9001\uFF0C\u6B63\u5728\u91CD\u65B0\u6BD4\u8F83\u2026"));
        }
      }
    } catch (error) {
      new import_obsidian.Notice(error.message, 1e4);
    } finally {
      notice?.hide();
      this.busy = false;
    }
  }
};
module.exports = module.exports.default;
