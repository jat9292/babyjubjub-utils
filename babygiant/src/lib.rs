// This is an adaptation of the babygiant-alt-bn128 crate to make it compatible with WASM: 
// instead of using several threads, we use a single thread but we search for the discrete log in a range [min_range, max_range]
// this is to allow to use parallelization through Web Wrokers in the Javascript code.

use ark_ed_on_bn254::{EdwardsAffine as BabyJubJub, Fr, Fq, EdwardsParameters};
use ark_ff::{BigInteger256, field_new, PrimeField, BigInteger, SquareRootField};
use ark_ec::{AffineCurve, ProjectiveCurve};
use ark_ec::twisted_edwards_extended::{GroupProjective, GroupAffine};
use hex;
use std::collections::HashMap;
use regex::Regex;
use wasm_bindgen::prelude::*;

fn baby_giant(max_bitwidth: u64, 
    a: &GroupAffine<EdwardsParameters>, 
    b: &GroupProjective<EdwardsParameters>, 
    min_range: u64, 
    max_range: u64
) -> Option<u64> {
    let m = 1u64 << (max_bitwidth / 2);

    let mut table = HashMap::new();
    let mut v = a.mul(Fr::new(BigInteger256::from(min_range))).into_affine();
    let a1 = a.mul(Fr::new(BigInteger256::from(1))).into_affine();

    for j in min_range..max_range {
        // baby_steps
        table.insert(v, j);
        v = v + a1; // original zkay version was doing scalar multiplication inside the loop, we replaced it by constant increment, because addition is faster than scalar multiplication on the elliptic curve, this lead to a 7x speedup
    }
    let am = a.mul(Fr::new(BigInteger256::from(m)));
    let mut gamma = b.clone();

    for i in 0..m {
        // giant_steps
        if let Some(j) = table.get(&gamma.into_affine()) {
            return Some(i * m + j);
        }
        gamma = gamma - &am;
    }
    panic!("No discrete log found");
}

fn parse_be_bytes_str(s: &str) -> BigInteger256 {
    let s = s.trim_start_matches("0x");
    let le_str = reverse_byte_order(s);
    parse_le_bytes_str(&le_str)
}

fn reverse_byte_order(s: &str) -> String {
    s.as_bytes()
        .chunks_exact(2)
        .rev()
        .map(|chunk| std::str::from_utf8(chunk).unwrap())
        .collect()
}

fn parse_le_bytes_str(s: &str) -> BigInteger256 {
    let mut buffer = [0u8; 32];     // 32 bytes for 256 bits

    let v = hex::decode(s).unwrap();
    assert_eq!(v.len(), 32);
    let v = v.as_slice();
    for i in 0..32 {
        buffer[i] = v[i];
    }

    let mut bi = BigInteger256::new([0; 4]);
    bi.read_le(&mut buffer.as_ref()).unwrap();
    return bi;
}

fn pad_with_zeros(input: &str) -> String {
    if input.len() < 66 && input.starts_with("0x") {
        let padding_needed = 66 - input.len();
        format!("0x{}{}", "0".repeat(padding_needed), &input[2..])
    } else {
        input.to_string()
    }
}

fn is_valid_format(input: &str) -> bool {
    let re = Regex::new(r"^0x[a-fA-F0-9]{64}$").unwrap();
    re.is_match(input)
}

#[wasm_bindgen]
pub fn do_compute_dlog(x: &str, y: &str, min_range: u64, max_range: u64) -> u64 {
    let padded_x = pad_with_zeros(&x);
    let padded_y = pad_with_zeros(&y);
    
    if !is_valid_format(&padded_x) || !is_valid_format(&padded_y)  {
        eprintln!(r#"Invalid input format : x and y should be hexadecimal strings representing two bytes of size 32 at most. 
Also make sure the coordinates x and y are points on the Baby Jubjub curve (Twisted Edwards form) and follow the same format as returned by the exp_elgamal_decrypt function in the noir-elgamal package).
Eg of valid inputs: x="0xbb77a6ad63e739b4eacb2e09d6277c12ab8d8010534e0b62893f3f6bb957051" and y="0x25797203f7a0b24925572e1cd16bf9edfce0051fb9e133774b3c257a872d7d8b".
Also please keep in mind that the embedded plaintext corresponding to the (x,y) point should not exceed type(uint40).max, i.e 1099511627775 or else the program will not find a valid discrete logarithm and panic."#);
        std::process::exit(1);
    }

    let coeff_twisted = field_new!(Fq,"168700").sqrt().unwrap(); // this coeff_twisted was introduced to transform the coordinates of baby Jubjub points from the Twisted Edwards form coming from Noir, to the Edwards form compatible with arkworks
    let gx = field_new!(Fq, "5299619240641551281634865583518297030282874472190772894086521144482721001553")*coeff_twisted;
    let gy = field_new!(Fq, "16950150798460657717958625567821834550301663161624707787222815936182638968203");
    let a = BabyJubJub::new(gx, gy); // the base point of the twisted Edwards form of Baby Jubjub : https://eips.ethereum.org/EIPS/eip-2494#forms-of-the-curve
    assert!(BabyJubJub::is_on_curve(&a), "(x,y) is not a valid point on Baby Jubjub curve in Twisted Edwards form");
    assert!(BabyJubJub::is_in_correct_subgroup_assuming_on_curve(&a), "(x,y) is not a valid point in the prime subgroup of Baby Jubjub curve in Twisted Edwards form");
    let bx = Fq::from_repr(parse_be_bytes_str(&padded_x)).unwrap()*coeff_twisted;
    let by = Fq::from_repr(parse_be_bytes_str(&padded_y)).unwrap();
    let b = BabyJubJub::new(bx, by);
    assert!(BabyJubJub::is_on_curve(&b), "(x,y) is not a valid point on Baby Jubjub curve in Twisted Edwards form");
    assert!(BabyJubJub::is_in_correct_subgroup_assuming_on_curve(&b), "(x,y) is not a valid point in the prime subgroup of Baby Jubjub curve in Twisted Edwards form");
    let b = b.mul(Fr::new(BigInteger256::from(1)));

    baby_giant(40, &a, &b, min_range, max_range).expect("The Baby-step Giant-step algorithm was unable to solve the Discrete Logarithm. Make sure that the embedded plaintext is an unsigned integer between 0 and 1099511627775.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_dlog1() {
        let dlog = do_compute_dlog("0x05e712cbd0bee349ab612d42b81672d48546ab29a90798ad2b88f64585f0c805",
                                   "0xbdb2d53146a7d643d6c6870319fe563a253f78c18a48e3fa45b6d7d9d3c310",0,100000);
        assert_eq!(65545, dlog);
    }
}