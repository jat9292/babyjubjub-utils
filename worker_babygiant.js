import { parentPort } from "worker_threads";

parentPort.onmessage = async function(event) {
    const wasm = await import("./babygiant/pkg/babygiant.js");
    const { Cx, Cy, min_range, max_range } = event.data;
    try {
      console.log('in')
      const output = await wasm.do_compute_dlog(Cx, Cy, BigInt(min_range), BigInt(max_range));
      console.log(output)
      parentPort.postMessage(output);
    } catch (e) {
      console.log(e)
      parentPort.postMessage("dl_not_found");
    }
    parentPort.close();
};