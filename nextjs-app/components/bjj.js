"use client"

import { generatePrivateAndPublicKey, packPoint, elgamalEncryptPacked, elgamalDecryptEmbedded, compute_dlog, bigintToBytes32 } from "babyjubjub-utils";
import { useState } from "react";

export default function KeyGenerator() {
  const [keys, setKeys] = useState({
    privateKey: BigInt(0),
    publicKey: BigInt(0),
  });

  const [inputValue, setInputValue] = useState(''); // Initialize input value state
  const [result, setResult] = useState(null); // Initialize result state

  const handleGenerate = async () => {
    const generatedKeys = await generatePrivateAndPublicKey();
    const privateKey = generatedKeys.privateKey;
    const publicKey = await packPoint(generatedKeys.publicKey);
    generatedKeys.publicKey = publicKey;
    setKeys(generatedKeys);
  };

  const handleButtonClick = () => {
    const processedResult = processInput(inputValue);
    setResult(processedResult);
  };

  const processInput = async (value) => {
    const { C1: encryptedValueC1, C2: encryptedValueC2 } = await elgamalEncryptPacked(keys.publicKey, Number(value));
    const decryptedEmbedded = await elgamalDecryptEmbedded(keys.privateKey, encryptedValueC1, encryptedValueC2);
    let result_ = await compute_dlog(decryptedEmbedded,8);
    return result_;
  };

  return (
    <div>
      {<button onClick={handleGenerate}>Generate New Keys</button>}
          <p>
            <strong>Private Key:</strong> {bigintToBytes32(keys.privateKey)}
          </p>
          <p>
            <strong>Public Key:</strong> {bigintToBytes32(keys.publicKey)}
          </p>
      {keys.publicKey!==BigInt(0) && (<div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter text..."
        />
        <button onClick={handleButtonClick}>Encrypt then Decrypt</button>
        {result && (
          <p>
            Result: <strong>{result}</strong>
          </p>
        )}
      </div>)}
    </div>
  );
}