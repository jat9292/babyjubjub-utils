import { parentPort } from "worker_threads";

async function main() {
    parentPort.on('message', async function(data) {
        const wasm = await import("./babygiant/pkg_nodejs/babygiant.js");

        const {Cx, Cy, min_range, max_range}  = data;
        try {
            const output = wasm.do_compute_dlog(Cx, Cy, BigInt(min_range), BigInt(max_range));
            parentPort.postMessage(output);
        } catch (e) {
            parentPort.postMessage("dl_not_found");
        }
    });
}

main();