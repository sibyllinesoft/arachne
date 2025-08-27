function vm(bytecode) {
    var pc = 0, stack = [], vars = {};
    while (pc < bytecode.length) {
        switch (bytecode[pc++]) {
            case 0x01: stack.push(bytecode[pc++]); break;
            case 0x02: console.log(stack.pop()); break;
            case 0x03: return;
        }
    }
}
vm([0x01, 0x48656c6c6f, 0x02, 0x03]);