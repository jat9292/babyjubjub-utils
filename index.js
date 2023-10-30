import { buildBabyjub }  from "circomlibjs";
import crypto from "crypto";
//import { Worker } from "worker_threads";
//import do_compute_dlog from  "./babygiant/pkg_web/babygiant.js"
    

/**
 * @typedef {Object} Point
 * @property {bigint} x - The X coordinate.
 * @property {bigint} y - The Y coordinate.
 */

/**
 * @typedef {Object} KeyPair
 * @property {bigint} privateKey - The private key.
 * @property {Point} publicKey - The public key in uncompressed format, i.e a point on Baby Jubjub.
 */

/**
 * @typedef {Object} EncryptedValue
 * @property {Point} C1 - C1 is the first part of the ciphertext, a point in Baby Jubjub. Same notations as on {@link https://en.wikipedia.org/wiki/ElGamal_encryption|wikipedia}.
 * @property {Point} C2 - C2 is the second part of the ciphertext, a point in Baby Jubjub. Same notations as on {@link https://en.wikipedia.org/wiki/ElGamal_encryption|wikipedia}.
 * @property {bigint} randomness - randomness parameter. <strong style="color: red;">Warning:</strong> should stay private, but we could use it as a private input in the circuits.
 */


// Internal functions
let babyJub;

async function getBabyJub() {
  if (!babyJub) {
    babyJub = await buildBabyjub();
  }
  return babyJub;
}

function _getRandomBigInt(maxBigInt) {
    // Calculate the byte length
    const byteLength = (maxBigInt.toString(16).length + 1) >> 1;
    while (true) {
        const buf = crypto.randomBytes(byteLength);
        let num = BigInt('0x' + buf.toString('hex'));

        if (num <= maxBigInt) {
            return num;
        }
    }
}

function _uint8ArrayToBigIntNoModP(arr) {
    let result = 0n;
    for (const byte of arr.reverse()) {
        result = (result << 8n) + BigInt(byte);
    }
    return result;
}

function _bigIntToUint8ArrayNoModP(bigIntValue) {
    const result = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
        result[i] = Number(bigIntValue & 0xFFn);
        bigIntValue >>= 8n;
    }
    return result.reverse();
}

//External functions of the library

/**
 * Converts a private key to its corresponding public key point on the Baby Jubjub curve.
 *
 * @param {bigint} privateKey - The private key. <strong style="color: red;">Warning:</strong> should be a BigInt sampled randomly between 0 and l-1, where l is the order of the bigprime subgroup of Baby Jubjub. i.e l=2736030358979909402780800718157159386076813972158567259200215660948447373041
 * @returns {Point} The public key point with x and y coordinates which corresponds to the private key.
 */
export async function privateToPublicKey(privateKey){
    const babyJub = await getBabyJub();
    const publicKeyPoint = babyJub.mulPointEscalar(babyJub.Base8,privateKey); // A point on Baby Jubjub : C = (CX, Cy)
    return {"x":babyJub.F.toObject(publicKeyPoint[0]),
            "y":babyJub.F.toObject(publicKeyPoint[1])}
}

/**
 * Generates randomly a pair of private/public keys on Baby Jubjub.
 *
 * @returns {KeyPair} The generated private key and its associated uncompressed/unpacked public key.
 */
export async function generatePrivateAndPublicKey() {
    const max_value = BigInt('2736030358979909402780800718157159386076813972158567259200215660948447373041'); // max value should be l (https://eips.ethereum.org/EIPS/eip-2494), the order of the big subgroup to avoid modulo bias
    const privateKey = _getRandomBigInt(max_value);
    const publicKey = await privateToPublicKey(privateKey);
    return {"privateKey":privateKey, "publicKey":publicKey};
}

/**
 * Encrypts a plaintext value between 0 and 2**40-1=1099511627775 for a specific publicKey. The returned ciphertext using ElGamal encryption is a pair of Baby Jubjub points (C1,C2).
 *
 * @param {Point} publicKey - The public key. <strong style="color: red;">Warning:</strong> The developer must ensures that this point is a valid public key, i.e a point on the big prime subgroup of Baby Jubjub.
 * @param {number} plaintext - The plaintext. <strong style="color: red;">Warning:</strong> should be a number between 0 and 2**40-1=1099511627775 if you want to be able to decrypt it later using the baby-step giant-step algorithm.
 * @returns {EncryptedValue} The encryption of plaintext. (C1,C2) is the ciphertext composed of two Baby Jubjub points, and randomness is the big integer used as randomness during encryption which should stay private for the encrypter.
 */
export async function elgamalEncrypt(publicKey, plaintext) {  
    const babyJub = await getBabyJub();
    // Check if it's a number and an integer in uint40 range
    if (typeof plaintext === 'number' && Number.isInteger(plaintext) && plaintext >= 0 && plaintext <= 1099511627775) {
        const max_value = BigInt('2736030358979909402780800718157159386076813972158567259200215660948447373041'); // max value should be l (https://eips.ethereum.org/EIPS/eip-2494), the order of the big subgroup to avoid modulo bias
        const randomness = _getRandomBigInt(max_value);
        const C1P = babyJub.mulPointEscalar(babyJub.Base8,randomness);
        const plain_embedded = babyJub.mulPointEscalar(babyJub.Base8,plaintext);
        const shared_secret = babyJub.mulPointEscalar([babyJub.F.e(publicKey.x),babyJub.F.e(publicKey.y)],randomness);
        const C2P = babyJub.addPoint(plain_embedded,shared_secret);
        const C1 = {"x":babyJub.F.toObject(C1P[0]),
                    "y":babyJub.F.toObject(C1P[1])};
        const C2 = {"x":babyJub.F.toObject(C2P[0]),
                    "y":babyJub.F.toObject(C2P[1])};
        return {"C1":C1, "C2": C2, "randomness": randomness}; // randomness should stay private, but we need it as private inputs in the circuit
    }
        else {
            throw new Error("Plain value most be an integer in uint40 range");
        }
}

/**
 * Decrypts the ciphertext in an embedded form, i.e as a point on the Baby Jubjub curve defined by G^(plaintext), G is the generator point. You would still need to appy the Baby-step Giant-step algorithm to get back the original unencrypted value.
 *
 * @param {bigint} privateKey - The privatekey key.
 * @param {Point} C1 - the first part of the ciphertext, a point in Baby Jubjub. Same notations as on {@link https://en.wikipedia.org/wiki/ElGamal_encryption|wikipedia}.
 * @param {Point} C2 - the second part of the ciphertext, a point in Baby Jubjub. Same notations as on {@link https://en.wikipedia.org/wiki/ElGamal_encryption|wikipedia}.
 * @returns {Point} The decrypted value in embedded form.
 */
export async function elgamalDecryptEmbedded(privateKey, C1, C2) {
    const babyJub = await getBabyJub();
    const shared_secret = babyJub.mulPointEscalar([babyJub.F.e(C1.x),babyJub.F.e(C1.y)],privateKey);
    const shared_secret_inverse = babyJub.mulPointEscalar(shared_secret,2736030358979909402780800718157159386076813972158567259200215660948447373040n); // Note : this BigInt is equal to l-1, this equivalent here to -1, to take the inverse of shared_secret, because mulPointEscalar only supports positive values for the second argument
    const plain_embedded = babyJub.addPoint([babyJub.F.e(C2.x),babyJub.F.e(C2.y)],shared_secret_inverse);
    return {"x":babyJub.F.toObject(plain_embedded[0]),
            "y":babyJub.F.toObject(plain_embedded[1])};
}

/**
 * Adds two points on the Baby Jubjub curve. Could be used for homomorphic addition of ciphertexts, eg : (C1,C2)+(C1',C2')=((C1+C1'),(C2+C2'))
 *
 * @param {Point} P1 - First point. <strong style="color: red;">Warning:</strong> The developer must ensures that this point is on the Baby Jubjub curve.
 * @param {Point} P2 - Second point. <strong style="color: red;">Warning:</strong> The developer must ensures that this point is on the Baby Jubjub curve.
 * @returns {Point} The resulting point from addition, i.e P1+P2.
 */
export async function addPoints(P1, P2) { // Used for (homomorphic) addition of baby jubjub (encrypted) points
    const babyJub = await getBabyJub();
    const Psum = babyJub.addPoint([babyJub.F.e(P1.x),babyJub.F.e(P1.y)],[babyJub.F.e(P2.x),babyJub.F.e(P2.y)]);
    return {"x":babyJub.F.toObject(Psum[0]),
            "y":babyJub.F.toObject(Psum[1])};
}

/**
 * Packs a public key, from uncompressed form (i.e a point on the big subgroup of Baby Jubjub) to a compressed form (i.e a BigInt)
 *
 * @param {Point} publicKey - The uncompressed/unpacked public key. <strong style="color: red;">Warning:</strong> The developer must ensures that this point is on the Baby Jubjub curve.
 * @returns {bigint} The resulting compressed/packed public key.
 */
export async function packPoint(publicKey){
    const babyJub = await getBabyJub();
    const packedPoint = babyJub.packPoint([babyJub.F.e(publicKey.x),babyJub.F.e(publicKey.y)]);
    const packedPublicKey = _uint8ArrayToBigIntNoModP(packedPoint);
    return packedPublicKey;
}

/**
 * Unpacks a packed public key, this is the opposite of `packPoint`
 *
 * @param {bigint} packedPublicKey - The packed public key. <strong style="color: red;">Warning:</strong> The developer must ensures that it is a valid public key.
 * @returns {Point} The resulting compressed/packed public key.
 */
export async function unpackPoint(packedPublicKey){
    const babyJub = await getBabyJub();
    const unpackedPoint = babyJub.unpackPoint(_bigIntToUint8ArrayNoModP(packedPublicKey));
    return {"x":babyJub.F.toObject(unpackedPoint[0]),
            "y":babyJub.F.toObject(unpackedPoint[1])};
}

/**
 * Converts a bigint to a string in hex format with 0s padded on the left if needed, to later cast it easily as a bytes32 in Solidity or Noir.
 *
 * @param {bigint} bigInt - The big integer. <strong style="color: red;">Warning:</strong> The developer must ensures that it is a valid uint256/bytes32.
 * @returns {string} The resulting hex string.
 */
export function bigintToBytes32(bigInt){
    const max = (BigInt(2) ** BigInt(256));
    if (bigInt >= max || bigInt <0) {
        throw new Error("The value is not between 0 and 2**256 - 1.");
    }
    return '0x' + ((bigInt).toString(16)).padStart(64, '0');
}

/**
 * This function is identical to `elgamalEncrypt` except that it takes the publick key in packed form instead of unpacked form.
 * Encrypts a plaintext value between 0 and 2**40-1=1099511627775 for a specific publicKey. The returned ciphertext using ElGamal encryption is a pair of Baby Jubjub points (C1,C2).
 *
 * @param {bigint} packedPublicKey - The public key. <strong style="color: red;">Warning:</strong> The developer must ensures that this point is a valid packed public key.
 * @param {number} plaintext - The plaintext. <strong style="color: red;">Warning:</strong> should be a number between 0 and 2**40-1=1099511627775 if you want to be able to decrypt it later using the baby-step giant-step algorithm.
 * @returns {EncryptedValue} The encryption of plaintext. (C1,C2) is the ciphertext composed of two Baby Jubjub points, and randomness is the big integer used as randomness during encryption which should stay private for the encrypter.
 */
export async function elgamalEncryptPacked(packedPublicKey, plaintext) {  
    const publicKey = await unpackPoint(packedPublicKey);
    return await elgamalEncrypt(publicKey,plaintext);
}

//export function babyStepGiantStep
//export function elgamalDecrypt

export async function compute_dlog(mode) {
    const privateKey = BigInt("0x0510bae26a9b59ebad67a4324c944b1910a778e8481d7f08ddba6bcd2b94b2c4");
    const publicKey = await packPoint(await privateToPublicKey(privateKey));

    const { C1: encryptedValueC1, C2: encryptedValueC2 } = await elgamalEncryptPacked(publicKey, 4444);
    const decryptedEmbedded = await elgamalDecryptEmbedded(privateKey, encryptedValueC1, encryptedValueC2);

    if (typeof window === 'undefined') {
        console.log('NODE')
            let do_compute_dlog;
            try {import('./babygiant/pkg_nodejs/babygiant.js').then(module => {
                do_compute_dlog = module.do_compute_dlog;
                console.log(do_compute_dlog.toString())
            });} catch{}
            
        //return do_compute_dlog(bigintToBytes32(decryptedEmbedded.x), bigintToBytes32(decryptedEmbedded.y), 0n, 10000n);
    } else {
        //import do_compute_dlog from "./babygiant/pkg_web/babygiant.js";
        console.log('WEB')
        //return do_compute_dlog(bigintToBytes32(decryptedEmbedded.x), bigintToBytes32(decryptedEmbedded.y), 0n, 10000n);
        let do_compute_dlog;
        import('./babygiant/pkg_web/babygiant.js').then(module => {
            do_compute_dlog = module.do_compute_dlog;
            console.log(do_compute_dlog.toString())
            // Use the module here
        });
    }
}


//console.log(do_compute_dlog_())





    



/*
let Embx = decryptedEmbedded.x;
let Emby = decryptedEmbedded.y;
const numberOfWorkers = 1; 
let workersCompleted = 0;
let found = false;

async function onWorkerMessage(event) {
  workersCompleted++;
  console.log(event.data.toString());
  if (event.data!=="dl_not_found") {
    console.log(event.data.toString());
    found = true;
  }
  if ((workersCompleted===numberOfWorkers) && !found){
    throw new Error("Discrete Log Not Found! Ensure private key is correct and encrypted value is between 0 and max(uint40).");
  }
}

let n = 1048576; // sqrt(max(uint40))
let chunkSize = Math.ceil(n / numberOfWorkers);

for (let i = 0; i < numberOfWorkers; i++) {
  const myWorker = new Worker('./worker_babygiant.js');
  myWorker.onmessage = onWorkerMessage;
  console.log(i)
  let start = i * chunkSize;
  let end = Math.min(n, start + chunkSize);
  myWorker.postMessage({ Cx: Embx, Cy: Emby, min_range: start, max_range: end });
}

setTimeout(()=>0,10000000)*/