/*
 * Copyright 2020 Google LLC
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var crypto = require('crypto');
let debugmode = process.argv[3]?process.argv[3]:false

function merge_options(obj1, obj2){
    var obj = {};
    for (var attrname in obj1) { obj[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj[attrname] = obj2[attrname]; }
    return obj;
}

function randomSalt(size) {
	return crypto.randomBytes(Math.ceil(size/2)).toString('hex').slice(0, size);
}

function hash(pwd, salt) {
	var _hash = crypto.createHmac('sha256', salt);  //Hashing algorithm sha512
    _hash.update(pwd);
    var value = _hash.digest('hex');
    return {
        salt: salt,
        passwordHash: value
    };
}

function makeSaltHash(pwd) {
	return hash(pwd, randomSalt(16));
}

function debuglog (logtext){
    if(debugmode) console.log(logtext)
}

module.exports = {
	makeSaltHash: makeSaltHash,
	hash: hash,
    merge_options: merge_options,
    debuglog: debuglog
};