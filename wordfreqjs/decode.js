/*

Copyright © 2019, Yves Goergen, https://unclassified.software/source/msgpack-js

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the “Software”), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

// https://github.com/ygoe/msgpack.js/blob/master/msgpack.js#L271

    function deserialize(array, options) {
        const pow32 = 0x100000000;   // 2^32
        let pos = 0;
        if (array instanceof ArrayBuffer) {
            array = new Uint8Array(array);
        }
        if (typeof array !== "object" || typeof array.length === "undefined") {
            throw new Error("Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize.");
        }
        if (!array.length) {
            throw new Error("Invalid argument: The byte array to deserialize is empty.");
        }
        if (!(array instanceof Uint8Array)) {
            array = new Uint8Array(array);
        }
        let data;
        if (options && options.multiple) {
            // Read as many messages as are available
            data = [];
            while (pos < array.length) {
                data.push(read());
            }
        }
        else {
            // Read only one message and ignore additional data
            data = read();
        }
        return data;

        function read() {
            const byte = array[pos++];
            if (byte >= 0x00 && byte <= 0x7f) return byte;   // positive fixint
            if (byte >= 0x80 && byte <= 0x8f) return readMap(byte - 0x80);   // fixmap
            if (byte >= 0x90 && byte <= 0x9f) return readArray(byte - 0x90);   // fixarray
            if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte - 0xa0);   // fixstr
            if (byte === 0xc0) return null;   // nil
            if (byte === 0xc1) throw new Error("Invalid byte code 0xc1 found.");   // never used
            if (byte === 0xc2) return false;   // false
            if (byte === 0xc3) return true;   // true
            if (byte === 0xc4) return readBin(-1, 1);   // bin 8
            if (byte === 0xc5) return readBin(-1, 2);   // bin 16
            if (byte === 0xc6) return readBin(-1, 4);   // bin 32
            if (byte === 0xc7) return readExt(-1, 1);   // ext 8
            if (byte === 0xc8) return readExt(-1, 2);   // ext 16
            if (byte === 0xc9) return readExt(-1, 4);   // ext 32
            if (byte === 0xca) return readFloat(4);   // float 32
            if (byte === 0xcb) return readFloat(8);   // float 64
            if (byte === 0xcc) return readUInt(1);   // uint 8
            if (byte === 0xcd) return readUInt(2);   // uint 16
            if (byte === 0xce) return readUInt(4);   // uint 32
            if (byte === 0xcf) return readUInt(8);   // uint 64
            if (byte === 0xd0) return readInt(1);   // int 8
            if (byte === 0xd1) return readInt(2);   // int 16
            if (byte === 0xd2) return readInt(4);   // int 32
            if (byte === 0xd3) return readInt(8);   // int 64
            if (byte === 0xd4) return readExt(1);   // fixext 1
            if (byte === 0xd5) return readExt(2);   // fixext 2
            if (byte === 0xd6) return readExt(4);   // fixext 4
            if (byte === 0xd7) return readExt(8);   // fixext 8
            if (byte === 0xd8) return readExt(16);   // fixext 16
            if (byte === 0xd9) return readStr(-1, 1);   // str 8
            if (byte === 0xda) return readStr(-1, 2);   // str 16
            if (byte === 0xdb) return readStr(-1, 4);   // str 32
            if (byte === 0xdc) return readArray(-1, 2);   // array 16
            if (byte === 0xdd) return readArray(-1, 4);   // array 32
            if (byte === 0xde) return readMap(-1, 2);   // map 16
            if (byte === 0xdf) return readMap(-1, 4);   // map 32
            if (byte >= 0xe0 && byte <= 0xff) return byte - 256;   // negative fixint
            console.debug("msgpack array:", array);
            throw new Error("Invalid byte value '" + byte + "' at index " + (pos - 1) + " in the MessagePack binary data (length " + array.length + "): Expecting a range of 0 to 255. This is not a byte array.");
        }

        function readInt(size) {
            let value = 0;
            let first = true;
            while (size-- > 0) {
                if (first) {
                    let byte = array[pos++];
                    value += byte & 0x7f;
                    if (byte & 0x80) {
                        value -= 0x80;   // Treat most-significant bit as -2^i instead of 2^i
                    }
                    first = false;
                }
                else {
                    value *= 256;
                    value += array[pos++];
                }
            }
            return value;
        }

        function readUInt(size) {
            let value = 0;
            while (size-- > 0) {
                value *= 256;
                value += array[pos++];
            }
            return value;
        }

        function readFloat(size) {
            let view = new DataView(array.buffer, pos + array.byteOffset, size);
            pos += size;
            if (size === 4)
                return view.getFloat32(0, false);
            if (size === 8)
                return view.getFloat64(0, false);
        }

        function readBin(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let data = array.subarray(pos, pos + size);
            pos += size;
            return data;
        }

        function readMap(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let data = {};
            while (size-- > 0) {
                let key = read();
                data[key] = read();
            }
            return data;
        }

        function readArray(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let data = [];
            while (size-- > 0) {
                data.push(read());
            }
            return data;
        }

        function readStr(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let start = pos;
            pos += size;
            return decodeUtf8(array, start, size);
        }

        function readExt(size, lengthSize) {
            if (size < 0) size = readUInt(lengthSize);
            let type = readUInt(1);
            let data = readBin(size);
            switch (type) {
                case 255:
                    return readExtDate(data);
            }
            return { type: type, data: data };
        }

        function readExtDate(data) {
            if (data.length === 4) {
                let sec = ((data[0] << 24) >>> 0) +
                    ((data[1] << 16) >>> 0) +
                    ((data[2] << 8) >>> 0) +
                    data[3];
                return new Date(sec * 1000);
            }
            if (data.length === 8) {
                let ns = ((data[0] << 22) >>> 0) +
                    ((data[1] << 14) >>> 0) +
                    ((data[2] << 6) >>> 0) +
                    (data[3] >>> 2);
                let sec = ((data[3] & 0x3) * pow32) +
                    ((data[4] << 24) >>> 0) +
                    ((data[5] << 16) >>> 0) +
                    ((data[6] << 8) >>> 0) +
                    data[7];
                return new Date(sec * 1000 + ns / 1000000);
            }
            if (data.length === 12) {
                let ns = ((data[0] << 24) >>> 0) +
                    ((data[1] << 16) >>> 0) +
                    ((data[2] << 8) >>> 0) +
                    data[3];
                pos -= 8;
                let sec = readInt(8);
                return new Date(sec * 1000 + ns / 1000000);
            }
            throw new Error("Invalid data length for a date value.");
        }
    }

    // Decodes a string from UTF-8 bytes.
    function decodeUtf8(bytes, start, length) {
        // Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
        let i = start, str = "";
        length += start;
        while (i < length) {
            let c = bytes[i++];
            if (c > 127) {
                if (c > 191 && c < 224) {
                    if (i >= length)
                        throw new Error("UTF-8 decode: incomplete 2-byte sequence");
                    c = (c & 31) << 6 | bytes[i++] & 63;
                }
                else if (c > 223 && c < 240) {
                    if (i + 1 >= length)
                        throw new Error("UTF-8 decode: incomplete 3-byte sequence");
                    c = (c & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
                }
                else if (c > 239 && c < 248) {
                    if (i + 2 >= length)
                        throw new Error("UTF-8 decode: incomplete 4-byte sequence");
                    c = (c & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
                }
                else throw new Error("UTF-8 decode: unknown multibyte start 0x" + c.toString(16) + " at index " + (i - 1));
            }
            if (c <= 0xffff) str += String.fromCharCode(c);
            else if (c <= 0x10ffff) {
                c -= 0x10000;
                str += String.fromCharCode(c >> 10 | 0xd800)
                str += String.fromCharCode(c & 0x3FF | 0xdc00)
            }
            else throw new Error("UTF-8 decode: code point 0x" + c.toString(16) + " exceeds UTF-16 reach");
        }
        return str;
    }

    