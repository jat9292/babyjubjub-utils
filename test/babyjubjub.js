import chai from "chai";
import * as bjj from '../index.js';


const assert = chai.assert;

function littleEndianArrayToBigEndianString(array_le){
    return '0x' + array_le.reverse().map(value => value.toString(16).padStart(2, '0')).join('');
}

describe("Baby JubJub js test", function () {
    it("Compressing public keys should return same results as the 'pack_point' function from noir-elgamal", () => {
        // same test as the noir-elgamal `test_pack_point` test: we just converted the [u8,32] little-endian format to a big-endian string to match the js function `bigintToBytes32`
        const publicKey = bjj.privateToPublicKey(BigInt("0x0510bae26a9b59ebad67a4324c944b1910a778e8481d7f08ddba6bcd2b94b2c4"))
        const packedPublicKey = bjj.packPoint(publicKey);
        assert.equal(bjj.bigintToBytes32(packedPublicKey),littleEndianArrayToBigEndianString(
            [0xdc, 0x9f, 0x9f, 0xdb, 0x74, 0x6d, 0x0f, 0x07, 0xb0, 0x04, 0xcc, 0x43, 0x16, 0xe3, 0x49, 0x5a, 0x58, 0x57, 0x0b, 0x90, 0x66, 0x14, 0x99, 0xf8, 0xa6, 0xa6, 0x69, 0x6f, 0xf4, 0x15, 0x6b, 0xaa]));
        
        const publicKey2 = bjj.privateToPublicKey(BigInt("0x03d7c10d654c601b60f2380551b4782896335c48f5d56662b1d0604dd22c8568"))
        const packedPublicKey2 = bjj.packPoint(publicKey2);
        assert.equal(bjj.bigintToBytes32(packedPublicKey2),littleEndianArrayToBigEndianString(
            [0x0c, 0x07, 0x99, 0x9c, 0x15, 0xd4, 0x06, 0xbc, 0x08, 0xd7, 0xf3, 0xf3, 0x1f, 0x62, 0xce, 0xdb, 0xc8, 0x9e, 0xbf, 0x3a, 0x53, 0xff, 0x4d, 0x3b, 0xf7, 0xe2, 0xd0, 0xdd, 0xa9, 0x31, 0x49, 0x04]));
        
        const publicKey3 = bjj.privateToPublicKey(BigInt("0x032336193e8d6ebf273828eb9d6600badbc7cd795c639dbe364307cd121473f2"))
        const packedPublicKey3 = bjj.packPoint(publicKey3);
        assert.equal(bjj.bigintToBytes32(packedPublicKey3),littleEndianArrayToBigEndianString(
            [0x29, 0x48, 0x3d, 0xe5, 0xe8, 0x1d, 0xe9, 0x89, 0x3b, 0x56, 0x58, 0xd6, 0x05, 0x01, 0xa4, 0x56, 0x19, 0x8f, 0xd4, 0xbb, 0x39, 0xe4, 0x91, 0x6c, 0x2e, 0x30, 0xf2, 0x42, 0x23, 0xdf, 0xf0, 0xa6]));
    })

    it("Unpacking a packed public key should return the original public key", () => {
        const private_keys = ["0x01e5cc52b94418c1d361a3479870df1f46fc4b3e697153843505053dd8b092da","0x05f53084112e74844b82f7cffe0ca07230681243ec3c77d53a6f31f5b04f7c4a",
            "0x04edd04fa218f3b0f32e109696a00baeb5f5b5bc6082b9dd53ff1ad1efe48f29","0x00edd199d52b82a65e7aaf6951f792462a84680022e139d8acf1c07d5168a827",
            "0x01975e987782456b7e73a34835934b6a20c196f750bc7390c0f7d8303b469f7e"];
        for (const private_key of private_keys) {
            const publicKey = bjj.privateToPublicKey(BigInt("0x0510bae26a9b59ebad67a4324c944b1910a778e8481d7f08ddba6bcd2b94b2c4"));
            const packedPublicKey = bjj.packPoint(publicKey);
            const unpackedPublicKey = bjj.unpackPoint(packedPublicKey);
            assert.equal(unpackedPublicKey.x,publicKey.x);
            assert.equal(unpackedPublicKey.y,publicKey.y);
        }
    })

    
});