// This is a slightly modified version of a benchmark
// from the Computer Language Benchmarks Game. The
// goal of this test is to verify that the function
// serialization system works even for non-trivial
// programs such as this.
//
// Original header:
//
// The Computer Language Benchmarks Game
// http://benchmarksgame.alioth.debian.org/
//
//  Contributed by Ian Osgood

import { expect } from 'chai';
import { serialize, deserialize } from '../../../serialize-closures/src';

function roundtrip<T>(value: T): T {
  return deserialize(serialize(value));
}

var last = 42, A = 3877, C = 29573, M = 139968;

function rand(max) {
  last = (last * A + C) % M;
  return max * last / M;
}

var ALU =
  "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG" +
  "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA" +
  "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT" +
  "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA" +
  "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG" +
  "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC" +
  "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA";

var IUB = {
  a:0.27, c:0.12, g:0.12, t:0.27,
  B:0.02, D:0.02, H:0.02, K:0.02,
  M:0.02, N:0.02, R:0.02, S:0.02,
  V:0.02, W:0.02, Y:0.02
}

var HomoSap = {
  a: 0.3029549426680,
  c: 0.1979883004921,
  g: 0.1975473066391,
  t: 0.3015094502008
}

function makeCumulative(table) {
  var last = null;
  for (var c in table) {
    if (last) table[c] += table[last];
    last = c;
  }
}

function fastaRepeat(n, seq) {
  let output = [];
  var seqi = 0, lenOut = 60;
  while (n>0) {
    if (n<lenOut) lenOut = n;
    if (seqi + lenOut < seq.length) {
      output.push(seq.substring(seqi, seqi+lenOut));
      seqi += lenOut;
    } else {
      var s = seq.substring(seqi);
      seqi = lenOut - s.length;
      output.push(s + seq.substring(0, seqi));
    }
    n -= lenOut;
  }
  return output;
}

function fastaRandom(n, table) {
  let output = [];
  var line = new Array(60);
  makeCumulative(table);
  while (n>0) {
    if (n<line.length) line = new Array(n);
    for (var i=0; i<line.length; i++) {
      var r = rand(1);
      for (var c in table) {
        if (r < table[c]) {
          line[i] = c;
          break;
        }
      }
    }
    output.push(line.join(''));
    n -= line.length;
  }
  return output;
}

function runFastaTest(n) {
  let results = [];
  results.push(">ONE Homo sapiens alu");
  results.push(fastaRepeat(2*n, ALU));

  results.push(">TWO IUB ambiguity codes");
  results.push(fastaRandom(3*n, IUB));

  results.push(">THREE Homo sapiens frequency");
  results.push(fastaRandom(5*n, HomoSap));
  return results;
}

export function fastaTest() {
  let n = 20;
  expect(roundtrip(runFastaTest)(n)).to.deep.equal(runFastaTest(n));
}
