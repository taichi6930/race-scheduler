import { ValidationError } from '../utilities/validationError';
import { badRequest } from './response';

/**
 * パース結果。ok=true なら値、ok=false なら 400 レスポンス。
 */
export type ParseResult<T> =
    | { ok: true; value: T }
    | { ok: false; response: Response };

/**
 * パース関数を実行し、ValidationError を badRequest レスポンスに変換する。
 * それ以外の例外は再スローし、呼び出し側の外側 try（handleControllerError）に委ねる。
 * 複数の Controller で重複していた「内側 try で ValidationError→badRequest、他は re-throw」を共通化する。
 * @param parse - パースを行う関数
 * @returns パース結果（成功値 or 400 レスポンス）
 */
export const parseOrBadRequest = <T>(parse: () => T): ParseResult<T> => {
    try {
        return { ok: true, value: parse() };
    } catch (error) {
        if (error instanceof ValidationError) {
            return {
                ok: false,
                response: badRequest(error.message, error.status),
            };
        }
        throw error;
    }
};
