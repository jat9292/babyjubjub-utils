# babyjubjub-utils
Node package implementing JS utils functions for interacting with the Baby Jubjub curve and the noir-elgamal Noir package.

⚠️ **Warning:** the current implementation of the baby-step giant-step algorithm in the last step of decryption is vulnerable to timing attacks, as the running time depends on the input. Please keep this in mind and exercise extra caution if you wish to use it in production.