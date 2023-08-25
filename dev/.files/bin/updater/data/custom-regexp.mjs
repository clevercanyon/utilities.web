/**
 * Dotfiles custom regexp.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 */
/* eslint-env es2021, node */

/**
 * There are three capture groups:
 *
 * 1. Everything beginning with `#` or `/*` leading up to and including a `<custom:start>` tag piece.
 * 2. The custom code itself, including all newlines, inside the `<custom:start></custom:end>` tag pieces.
 * 3. The closing `</custom:end>` tag piece.
 *
 * This expression supports the `/g` flag, in case that's ever needed, but we don't currently use it. i.e., Our goal is
 * simply to preserve the first `<custom:start></custom:end>` block found in any given dotfile.
 */
export default /((?<=(?:^|[\r\n]))[\t ]*(?:#+|\/\*+)(?:.(?!<\/custom:end>))*<custom:start>(?:[\t ]*\*+\/)?[\t ]*(?=[\r\n]))((?:.(?!(?:#+|\/\*+)[\t ]*<\/?custom:))*[\r\n]*)([\t ]*(?:#+|\/\*+)[\t ]*<\/custom:end>(?:[\t ]*\*+\/)?)/isu;
