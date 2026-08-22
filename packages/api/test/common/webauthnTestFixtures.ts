import type {
    AuthenticationResponseJSON,
    RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL, isoCBOR, toHash } from '@simplewebauthn/server/helpers';

/**
 * `@simplewebauthn/server`の本物の検証ロジックを通すための、構造的に正しい
 * WebAuthnレスポンスを組み立てるテスト用フィクスチャ。
 *
 * `mock.module`は使わない（プロセス内でモジュールレジストリを共有し、
 * `bunfig.toml`の`singleThreaded = false`によるテスト並行実行下で他ファイルへ
 * 波及することを確認したため）。`fmt:'none'`は署名検証を行わない属性証明形式
 * のため、暗号学的に妥当な鍵ペアを用意しなくても登録の検証成功パスを再現できる。
 * 一方ログイン（認証）は署名検証が必須のため、WebCryptoで実際にECDSA P-256の
 * 鍵ペアを生成し署名する（生成した生署名r||sは`@simplewebauthn/server`内部の
 * `@peculiar/asn1-ecc`によるDER→raw変換に対応させるため、DERへ手動変換する）。
 * 3ファイル（webauthn.test.ts / authUsecase.successPath.test.ts /
 * auth.component.test.ts）で必要になったため共通化した（Rule of Three）。
 */

/** ECDSA P-256の鍵ペアを生成する（登録→ログインを繋げるテストで使い回す用）。 */
export const generateP256KeyPair = (): Promise<CryptoKeyPair> =>
    crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
        'sign',
        'verify',
    ]);

/** 鍵ペアの公開鍵をraw形式（0x04 || x || y）からx/yへ分解する。 */
export const exportRawXY = async (
    keyPair: CryptoKeyPair,
): Promise<{ x: Uint8Array<ArrayBuffer>; y: Uint8Array<ArrayBuffer> }> => {
    const rawPublicKey = new Uint8Array(
        await crypto.subtle.exportKey('raw', keyPair.publicKey),
    );
    return { x: rawPublicKey.slice(1, 33), y: rawPublicKey.slice(33, 65) };
};

/**
 * `fmt:'none'`の構造的に正しい登録レスポンスを組み立てる。
 * `fmt:'none'`は署名検証を行わないため、`publicKeyXY`省略時はダミー値
 * （全ゼロ）で問題ない。登録したcredentialで実際にログインまで検証したい
 * 場合は、`generateP256KeyPair`で生成した鍵ペアの公開鍵をここへ渡し、
 * 同じ鍵ペアを`buildValidAuthenticationResponse`にも渡すことで、
 * 登録時に保存される公開鍵とログイン時の署名検証鍵を一致させる。
 */
export const buildValidNoneAttestationResponse = async (
    rpId: string,
    origin: string,
    challenge: string,
    credentialId: Uint8Array<ArrayBuffer>,
    publicKeyXY?: {
        x: Uint8Array<ArrayBuffer>;
        y: Uint8Array<ArrayBuffer>;
    },
): Promise<RegistrationResponseJSON> => {
    const { x, y } = publicKeyXY ?? {
        x: new Uint8Array(32),
        y: new Uint8Array(32),
    };
    const aaguid = new Uint8Array(16);
    const cosePublicKey = isoCBOR.encode(
        new Map<number, number | Uint8Array>([
            [1, 2], // kty: EC2
            [3, -7], // alg: ES256
            [-1, 1], // crv: P-256
            [-2, x],
            [-3, y],
        ]),
    );
    const credentialIdLength = new Uint8Array(2);
    new DataView(credentialIdLength.buffer).setUint16(0, credentialId.length);
    const rpIdHash = await toHash(rpId);
    // flags: UP(bit0) + UV(bit2) + AT(bit6) = 0b01000101
    const authenticatorData = new Uint8Array([
        ...rpIdHash,
        0b0100_0101,
        0,
        0,
        0,
        0, // signCount = 0
        ...aaguid,
        ...credentialIdLength,
        ...credentialId,
        ...cosePublicKey,
    ]);
    const attestationObject = isoCBOR.encode(
        new Map<string, string | Uint8Array | Map<string, never>>([
            ['fmt', 'none'],
            ['attStmt', new Map<string, never>()],
            ['authData', authenticatorData],
        ]),
    );
    const clientDataJSON = new TextEncoder().encode(
        JSON.stringify({ type: 'webauthn.create', challenge, origin }),
    );

    return {
        id: isoBase64URL.fromBuffer(credentialId),
        rawId: isoBase64URL.fromBuffer(credentialId),
        type: 'public-key',
        response: {
            clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
            attestationObject: isoBase64URL.fromBuffer(attestationObject),
        },
        clientExtensionResults: {},
    };
};

/** WebCryptoのECDSA生署名（r||s、各32バイト）をDER（SEQUENCE of 2 INTEGER）へ変換する。 */
export const derEncodeEcdsaSignature = (
    raw: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> => {
    const derEncodeInteger = (component: Uint8Array): Uint8Array => {
        let bytes = component;
        let start = 0;
        while (
            start < bytes.length - 1 &&
            bytes[start] === 0 &&
            (bytes[start + 1] & 0x80) === 0
        ) {
            start++;
        }
        bytes = bytes.slice(start);
        if ((bytes[0] & 0x80) !== 0) {
            bytes = new Uint8Array([0, ...bytes]);
        }
        return new Uint8Array([0x02, bytes.length, ...bytes]);
    };

    const r = derEncodeInteger(raw.slice(0, 32));
    const s = derEncodeInteger(raw.slice(32, 64));
    const body = new Uint8Array([...r, ...s]);
    return new Uint8Array([0x30, body.length, ...body]);
};

/**
 * 実ECDSA署名を持つ正当な認証レスポンスと対応する公開鍵（CBORエンコード済みCOSE鍵）を組み立てる。
 * `keyPair`省略時は都度新規生成する（webauthn.ts単体の検証成功パス確認用）。
 * 登録済みcredentialでのログインを検証する場合は、登録時に`buildValidNoneAttestationResponse`
 * へ渡したのと同じ鍵ペアをここにも渡すこと（省略すると署名検証に使われる公開鍵と
 * 実際の署名鍵が一致せず必ず失敗する）。
 */
export const buildValidAuthenticationResponse = async (
    rpId: string,
    origin: string,
    challenge: string,
    credentialId: Uint8Array<ArrayBuffer>,
    keyPair?: CryptoKeyPair,
): Promise<{
    response: AuthenticationResponseJSON;
    publicKey: Uint8Array<ArrayBuffer>;
}> => {
    const usedKeyPair = keyPair ?? (await generateP256KeyPair());
    const { x, y } = await exportRawXY(usedKeyPair);
    const cosePublicKey = isoCBOR.encode(
        new Map<number, number | Uint8Array>([
            [1, 2],
            [3, -7],
            [-1, 1],
            [-2, x],
            [-3, y],
        ]),
    ) as Uint8Array<ArrayBuffer>;

    const rpIdHash = await toHash(rpId);
    // assertionのauthenticatorDataは attestedCredentialData を含まない
    // （rpIdHash 32 + flags 1 + signCount 4 = 37バイト）。flags: UP+UV。
    const authenticatorData = new Uint8Array([
        ...rpIdHash,
        0b0000_0101,
        0,
        0,
        0,
        1, // signCount = 1
    ]);
    const clientDataJSON = new TextEncoder().encode(
        JSON.stringify({ type: 'webauthn.get', challenge, origin }),
    );
    const clientDataHash = new Uint8Array(
        await crypto.subtle.digest('SHA-256', clientDataJSON),
    );
    const signatureBase = new Uint8Array([
        ...authenticatorData,
        ...clientDataHash,
    ]);
    const rawSignature = new Uint8Array(
        await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            usedKeyPair.privateKey,
            signatureBase,
        ),
    );
    const signature = derEncodeEcdsaSignature(rawSignature);

    return {
        response: {
            id: isoBase64URL.fromBuffer(credentialId),
            rawId: isoBase64URL.fromBuffer(credentialId),
            type: 'public-key',
            response: {
                clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON),
                authenticatorData: isoBase64URL.fromBuffer(authenticatorData),
                signature: isoBase64URL.fromBuffer(signature),
            },
            clientExtensionResults: {},
        },
        publicKey: cosePublicKey,
    };
};
