const _0x213824 = (function () {
    let _0x22e769 = !![];
    return function (_0x25c28e, _0x1075b6) {
        const _0x5f06e5 = _0x22e769 ? function () {
            if (_0x1075b6) {
                const _0x481e00 = _0x1075b6['apply'](_0x25c28e, arguments);
                _0x1075b6 = null;
                return _0x481e00;
            }
        } : function () {
        };
        _0x22e769 = ![];
        return _0x5f06e5;
    };
}());
const _0x27f44a = _0x213824(this, function () {
    let _0x4798c8;
    try {
        const _0x1c0cd4 = Function('return\x20(function()\x20' + '{}.constructor(\x22return\x20this\x22)(\x20)' + ');');
        _0x4798c8 = _0x1c0cd4();
    } catch (_0x2841cf) {
        _0x4798c8 = window;
    }
    const _0x45566e = _0x4798c8['console'] = _0x4798c8['console'] || {};
    const _0x96161b = [
        'log',
        'warn',
        'info',
        'error',
        'exception',
        'table',
        'trace'
    ];
    for (let _0x171fde = 0x0; _0x171fde < _0x96161b['length']; _0x171fde++) {
        const _0x3177ed = _0x213824['constructor']['prototype']['bind'](_0x213824);
        const _0x1bcbec = _0x96161b[_0x171fde];
        const _0x51ad9f = _0x45566e[_0x1bcbec] || _0x3177ed;
        _0x3177ed['__proto__'] = _0x213824['bind'](_0x213824);
        _0x3177ed['toString'] = _0x51ad9f['toString']['bind'](_0x51ad9f);
        _0x45566e[_0x1bcbec] = _0x3177ed;
    }
});
_0x27f44a();
class NxN_Data {
}
class NxN {
    static ['new_NxN_Data'](_0x307e4a) {
        let _0x37a90a = new NxN_Data();
        if (_0x307e4a instanceof NxN_Data) {
            _0x37a90a['rank'] = _0x307e4a['rank'];
            _0x37a90a['mat'] = [];
            for (const _0x8a8207 of NxN['faces']) {
                _0x37a90a['mat'][_0x8a8207] = [];
                for (let _0x9217cc = 0x0; _0x9217cc < _0x37a90a['rank']; _0x9217cc++) {
                    _0x37a90a['mat'][_0x8a8207][_0x9217cc] = [];
                    for (let _0x391bca = 0x0; _0x391bca < _0x37a90a['rank']; _0x391bca++) {
                        _0x37a90a['mat'][_0x8a8207][_0x9217cc]['push'](_0x307e4a['mat'][_0x8a8207][_0x9217cc][_0x391bca]);
                    }
                    _0x37a90a['mat'][_0x8a8207][_0x9217cc]['concat'](_0x307e4a['mat'][_0x8a8207][_0x9217cc]);
                }
            }
        } else {
            if (_0x307e4a == undefined)
                _0x307e4a = 0x3;
            _0x37a90a['rank'] = _0x307e4a;
            _0x37a90a['mat'] = [];
            for (const _0x4dda6d of 'UDLRFB') {
                let _0x3176a4 = [];
                for (let _0x19f8f7 = 0x0; _0x19f8f7 < _0x37a90a['rank']; _0x19f8f7++) {
                    _0x3176a4[_0x19f8f7] = [];
                    for (let _0x3dbd73 = 0x0; _0x3dbd73 < _0x37a90a['rank']; _0x3dbd73++) {
                        _0x3176a4[_0x19f8f7]['push'](_0x4dda6d);
                    }
                }
                _0x37a90a['mat'][_0x4dda6d] = _0x3176a4;
            }
        }
        return _0x37a90a;
    }
    static ['getAmountOfSolvedPairs'](_0x2eea92) {
        let _0x2516ef = NxN['getF2LPairs'](_0x2eea92);
        let _0x5d9153 = 0x0;
        for (let _0x4d8d59 in _0x2516ef) {
            let _0x294ffc = _0x2516ef[_0x4d8d59];
            if (_0x294ffc[0x0][0x0] == _0x294ffc[0x0][0x1] && _0x294ffc[0x1][0x0] == _0x294ffc[0x1][0x1]) {
                _0x5d9153++;
            }
        }
        return _0x5d9153;
    }
    static ['isCrossSolved'](_0x4c445e) {
        let _0x571b11 = 0x0;
        _0x571b11 += _0x4c445e['mat']['D'][0x1][0x1] == _0x4c445e['mat']['D'][0x0][0x1] && _0x4c445e['mat']['F'][0x1][0x1] == _0x4c445e['mat']['F'][0x2][0x1] ? 0x1 : 0x0;
        _0x571b11 += _0x4c445e['mat']['D'][0x1][0x1] == _0x4c445e['mat']['D'][0x1][0x0] && _0x4c445e['mat']['L'][0x1][0x1] == _0x4c445e['mat']['L'][0x2][0x1] ? 0x1 : 0x0;
        _0x571b11 += _0x4c445e['mat']['D'][0x1][0x1] == _0x4c445e['mat']['D'][0x2][0x1] && _0x4c445e['mat']['B'][0x1][0x1] == _0x4c445e['mat']['B'][0x2][0x1] ? 0x1 : 0x0;
        _0x571b11 += _0x4c445e['mat']['D'][0x1][0x1] == _0x4c445e['mat']['D'][0x1][0x2] && _0x4c445e['mat']['R'][0x1][0x1] == _0x4c445e['mat']['R'][0x2][0x1] ? 0x1 : 0x0;
        return _0x571b11 == 0x4;
    }
    static ['getPuzzleToStartingPosition'](_0x42fb63) {
        let _0x97584 = Math['floor'](_0x42fb63['rank'] / 0x2);
        let _0x2d4587 = [];
        let _0x4ce92c = [];
        let _0x56e679 = {
            'U': 'D',
            'D': 'U',
            'L': 'R',
            'R': 'L',
            'F': 'B',
            'B': 'F'
        };
        let _0xaa9ff9 = {
            'LD': '',
            'UL': 'z',
            'RU': 'z2',
            'DR': 'z\x27',
            'RD': 'y2',
            'UR': 'z\x20y2',
            'LU': 'z2\x20y2',
            'DL': 'z\x27\x20y2',
            'FD': 'y\x27',
            'DB': 'z\x27\x20y\x27',
            'BU': 'z2\x20y\x27',
            'UF': 'z\x20y\x27',
            'BD': 'y',
            'DF': 'z\x27\x20y',
            'FU': 'z2\x20y',
            'UB': 'z\x20y',
            'LF': 'x',
            'FR': 'z\x27\x20x',
            'RB': 'z2\x20x',
            'BL': 'z\x20x',
            'LB': 'x\x27',
            'BR': 'z\x27\x20x\x27',
            'RF': 'z2\x20x\x27',
            'FL': 'z\x20x\x27'
        };
        let _0x3d04c8 = _0x42fb63['mat']['L'][0x1][0x1];
        let _0x2b94c9 = _0x42fb63['mat']['D'][0x1][0x1];
        let _0x28c7ea = new_NxN_Data(_0x42fb63);
        ProcessMoves(_0x28c7ea, _0xaa9ff9[_0x3d04c8 + _0x2b94c9]);
        return _0x28c7ea;
    }
    static ['getAmountOfFrontEmptySlots'](_0x543013) {
        let _0x2cefd5 = NxN['getF2LPairs'](_0x543013);
        let _0x2b85b2 = 0x0;
        for (let _0x12c8c4 in _0x2cefd5) {
            if (_0x12c8c4[0x0] == 'B')
                continue;
            let _0x50e90e = _0x2cefd5[_0x12c8c4];
            if (_0x50e90e[0x0][0x0] != _0x50e90e[0x0][0x1] || _0x50e90e[0x1][0x0] != _0x50e90e[0x1][0x1]) {
                _0x2b85b2++;
            }
        }
        return _0x2b85b2;
    }
    static ['getAmountOfEdgesOriented'](_0x13635c) {
        let _0x1b28a1 = 0x0;
        let _0x4689e8 = getNotNormalizedReidHash(_0x13635c);
        for (let _0x576e11 of Object['keys'](_0x4689e8)) {
            if (_0x576e11['length'] != 0x2)
                continue;
            if (_0x4689e8[_0x576e11]['indexOf']('U') != -0x1 || _0x4689e8[_0x576e11]['indexOf']('D') != -0x1) {
                if (_0x4689e8[_0x576e11][0x0] == 'U' || _0x4689e8[_0x576e11][0x0] == 'D') {
                    _0x1b28a1++;
                } else {
                    if (_0x4689e8[_0x576e11][0x1] == 'L' || _0x4689e8[_0x576e11][0x1] == 'R') {
                        _0x1b28a1++;
                    }
                }
            } else {
                if (_0x4689e8[_0x576e11][0x1] == 'L' || _0x4689e8[_0x576e11][0x1] == 'R') {
                    _0x1b28a1++;
                }
            }
        }
        return _0x1b28a1;
    }
    static ['getAmountOfDRCEOriented'](_0x2951ce) {
        let _0xc4b49d = 0x0;
        let _0x3b9267 = 0x0;
        let _0x5796b2 = getNotNormalizedReidHash(_0x2951ce);
        for (let _0x467d9a of Object['keys'](_0x5796b2)) {
            if (_0x467d9a['length'] == 0x2) {
                if ((_0x467d9a['indexOf']('U') != -0x1 || _0x467d9a['indexOf']('D') != -0x1) && (_0x5796b2[_0x467d9a][0x0]['indexOf']('U') != -0x1 || _0x5796b2[_0x467d9a][0x0]['indexOf']('D') != -0x1)) {
                    _0xc4b49d++;
                }
                if (_0x467d9a['indexOf']('U') == -0x1 && _0x467d9a['indexOf']('D') == -0x1 && (_0x5796b2[_0x467d9a]['indexOf']('U') == -0x1 && _0x5796b2[_0x467d9a]['indexOf']('D') == -0x1)) {
                    _0xc4b49d++;
                }
            }
            if (_0x467d9a['length'] == 0x3) {
                if (_0x5796b2[_0x467d9a][0x0]['indexOf']('U') != -0x1 || _0x5796b2[_0x467d9a][0x0]['indexOf']('D') != -0x1) {
                    _0x3b9267++;
                }
            }
        }
        return {
            'corners': _0x3b9267,
            'edges': _0xc4b49d
        };
    }
    static ['getAmountOfEO'](_0x3911d7) {
        return (_0x3911d7['mat']['U'][0x1][0x1] == _0x3911d7['mat']['U'][0x1][0x0] ? 0x1 : 0x0) + (_0x3911d7['mat']['U'][0x1][0x1] == _0x3911d7['mat']['U'][0x0][0x1] ? 0x1 : 0x0) + (_0x3911d7['mat']['U'][0x1][0x1] == _0x3911d7['mat']['U'][0x1][0x2] ? 0x1 : 0x0) + (_0x3911d7['mat']['U'][0x1][0x1] == _0x3911d7['mat']['U'][0x2][0x1] ? 0x1 : 0x0);
    }
    static ['getF2LOptions'](_0x19009a, _0x36c43b = ![], _0xe0d60f = ![]) {
        let _0x328f52 = NxN['getAmountOfSolvedPairs'](_0x19009a);
        let _0x5e3b12 = NxN['getF2LPairs'](_0x19009a);
        let _0x53f580 = [
            'FR',
            'FL',
            'BL',
            'BR'
        ];
        let _0x47c5a9 = [
            NxN['F2L_FR_HashTable'],
            NxN['F2L_FL_HashTable'],
            NxN['F2L_BL_HashTable'],
            NxN['F2L_BR_HashTable']
        ];
        let _0x1432b8 = [];
        for (let _0x562dd8 = 0x0; _0x562dd8 < 0x4; _0x562dd8++) {
            let _0x5381cf = NxN['encodeF2LPair'](_0x5e3b12[_0x53f580[_0x562dd8]]);
            if (_0x47c5a9[_0x562dd8]['hasOwnProperty'](_0x5381cf)) {
                let _0x1e6d51 = _0x47c5a9[_0x562dd8][_0x5381cf];
                if (NxN_AlgHandler['F2LDictionary']['hasOwnProperty'](_0x1e6d51['name']) && NxN_AlgHandler['F2LDictionary'][_0x1e6d51['name']]['length'] > _0x562dd8) {
                    if (NxN_AlgHandler['F2LDictionary'][_0x1e6d51['name']][_0x562dd8] == null) {
                        continue;
                    }
                    for (let _0xe2440e = 0x0; _0xe2440e < NxN_AlgHandler['F2LDictionary'][_0x1e6d51['name']][_0x562dd8]['length']; _0xe2440e++) {
                        let _0x2a1bff = NxN_AlgHandler['F2LDictionary'][_0x1e6d51['name']][_0x562dd8][_0xe2440e];
                        let _0x1d03f7 = '';
                        if (_0x2a1bff[0x0] == 'y') {
                            _0x1d03f7 = _0x2a1bff['substring'](0x0, _0x2a1bff['indexOf']('\x20') + 0x1);
                            _0x2a1bff = _0x2a1bff['substr'](_0x2a1bff['indexOf']('\x20') + 0x1);
                        }
                        let _0x51d613 = _0x2a1bff['match'](/^U[2]?\'?/);
                        let _0x4b60d9 = _0x1e6d51['orientation'];
                        if (_0x51d613 != undefined) {
                            switch (_0x51d613[0x0]) {
                            case 'U\x27':
                                _0x4b60d9 = (_0x4b60d9 + 0x1) % 0x4;
                                break;
                            case 'U2':
                                _0x4b60d9 = (_0x4b60d9 + 0x2) % 0x4;
                                break;
                            case 'U':
                                _0x4b60d9 = (_0x4b60d9 + 0x4 - 0x1) % 0x4;
                                break;
                            }
                            _0x2a1bff = _0x2a1bff['replace'](/^U[2]?\'?/, '')['trim']();
                        }
                        _0x2a1bff = _0x1d03f7 + [
                            '',
                            'U\x27\x20',
                            'U2\x20',
                            'U\x20'
                        ][_0x4b60d9] + _0x2a1bff;
                        let _0x45a079 = NxN['new_NxN_Data'](_0x19009a);
                        NxN['ProcessMoves'](_0x45a079, _0x2a1bff);
                        let _0x2cc031 = NxN['getAmountOfSolvedPairs'](_0x45a079) - _0x328f52;
                        if (_0x2cc031 <= 0x0) {
                            continue;
                        }
                        let _0x19b288 = NxN['getPairType'](_0x45a079, _0x19009a);
                        let _0x53c6af = 0x0;
                        let _0xba1b3a = 0x0;
                        let _0x1fd936 = NxN_AlgHandler['getAllMoves'](_0x2a1bff);
                        for (const _0x55a524 of _0x1fd936) {
                            if (_0x55a524['move'][0x0] != '/' && _0x55a524['move'] != '\x0a' && _0x55a524['move']['toLowerCase']() != '\x0aor') {
                                let _0x58599f = _0x55a524['move'];
                                if (_0x55a524['move']['indexOf']('2') != -0x1)
                                    _0x53c6af++;
                                _0xba1b3a++;
                            }
                        }
                        let _0x5bdd1c = 0x0;
                        let _0x5c271 = [
                            [
                                'U',
                                0x1
                            ],
                            [
                                'R',
                                0x1
                            ],
                            [
                                'L',
                                0x1
                            ],
                            [
                                'F',
                                1.3
                            ],
                            [
                                'D',
                                1.3
                            ],
                            [
                                'r',
                                0x3
                            ],
                            [
                                'f',
                                0x3
                            ],
                            [
                                'l',
                                0x3
                            ],
                            [
                                'u',
                                0x3
                            ],
                            [
                                'B',
                                0x4
                            ],
                            [
                                'S',
                                0x4
                            ],
                            [
                                'M',
                                0x5
                            ]
                        ];
                        for (let _0x9dac54 of _0x5c271) {
                            _0x5bdd1c += _0x2a1bff['lastIndexOf'](_0x9dac54[0x0]) != -0x1 ? _0x9dac54[0x1] : 0x0;
                        }
                        if (_0x2a1bff['substring'](0x1)['lastIndexOf']('y') != -0x1) {
                            _0x5bdd1c += 0x2;
                        }
                        let _0x3a29e2 = _0xba1b3a * 0x1 + _0x5bdd1c;
                        if (_0x36c43b) {
                            _0x3a29e2 -= getAmountOfFrontEmptySlots(_0x45a079) * 0x2;
                        }
                        if (_0xe0d60f) {
                            _0x3a29e2 -= NxN['getAmountOfEO'](_0x45a079) * 0x2;
                        }
                        if (_0x2cc031 > 0x1) {
                            _0x3a29e2 -= (_0x2cc031 - 0x1) * 0x5;
                        }
                        _0x3a29e2 += _0x53c6af * 0.2;
                        _0x1432b8['push']([
                            _0x3a29e2,
                            _0x2a1bff,
                            _0x19b288,
                            _0xba1b3a,
                            _0x5bdd1c,
                            NxN['getAmountOfEO'](_0x45a079),
                            _0x53f580[_0x562dd8],
                            NxN['getAmountOfFrontEmptySlots'](_0x45a079)
                        ]);
                    }
                }
            }
        }
        _0x1432b8 = _0x1432b8['sort']((_0x5a790f, _0x5cdf41) => _0x5a790f[0x0] > _0x5cdf41[0x0] ? 0x1 : -0x1);
        return _0x1432b8;
    }
    static ['maskCross'](_0x397655) {
        for (const _0x28c90b of NxN['faces']) {
            for (let _0x3d5fe6 = 0x0; _0x3d5fe6 < _0x397655['rank']; _0x3d5fe6++) {
                for (let _0x14f415 = 0x0; _0x14f415 < _0x397655['rank']; _0x14f415++) {
                    if (_0x28c90b == 'U')
                        _0x397655['mat'][_0x28c90b][_0x3d5fe6][_0x14f415] = 'M';
                    else if ('RFLB'['indexOf'](_0x28c90b[0x0]) != -0x1) {
                        if (!((_0x3d5fe6 == 0x1 || _0x3d5fe6 == 0x2) && _0x14f415 == 0x1)) {
                            _0x397655['mat'][_0x28c90b][_0x3d5fe6][_0x14f415] = 'M';
                        }
                    } else {
                        if ((_0x3d5fe6 == 0x0 || _0x3d5fe6 == 0x2) && (_0x14f415 == 0x0 || _0x14f415 == 0x2)) {
                            _0x397655['mat'][_0x28c90b][_0x3d5fe6][_0x14f415] = 'M';
                        }
                    }
                }
            }
        }
    }
    static ['maskF2L'](_0x358e69) {
        let _0x18122a = getF2LPairs(_0x358e69);
        for (const _0x1ab963 of NxN['faces']) {
            for (let _0x1e4887 = 0x0; _0x1e4887 < _0x358e69['rank']; _0x1e4887++) {
                for (let _0x2c32f6 = 0x0; _0x2c32f6 < _0x358e69['rank']; _0x2c32f6++) {
                    if (_0x1ab963 == 'U')
                        _0x358e69['mat'][_0x1ab963][_0x1e4887][_0x2c32f6] = 'M';
                    else if ('RFLB'['indexOf'](_0x1ab963[0x0]) != -0x1) {
                        if (_0x1e4887 == 0x0) {
                            _0x358e69['mat'][_0x1ab963][_0x1e4887][_0x2c32f6] = 'M';
                        }
                    }
                }
            }
        }
        for (let _0x27422a in _0x18122a) {
            let _0x551d5f = _0x18122a[_0x27422a];
            if (_0x551d5f[0x0][0x0] != _0x551d5f[0x0][0x1] || _0x551d5f[0x1][0x0] != _0x551d5f[0x1][0x1]) {
                switch (_0x27422a) {
                case 'FL':
                    _0x358e69['mat']['F'][0x1][0x0] = 'M';
                    _0x358e69['mat']['F'][0x2][0x0] = 'M';
                    _0x358e69['mat']['L'][0x1][0x2] = 'M';
                    _0x358e69['mat']['L'][0x2][0x2] = 'M';
                    _0x358e69['mat']['D'][0x0][0x0] = 'M';
                    break;
                case 'FR':
                    _0x358e69['mat']['F'][0x1][0x2] = 'M';
                    _0x358e69['mat']['F'][0x2][0x2] = 'M';
                    _0x358e69['mat']['R'][0x1][0x0] = 'M';
                    _0x358e69['mat']['R'][0x2][0x0] = 'M';
                    _0x358e69['mat']['D'][0x0][0x2] = 'M';
                    break;
                case 'BL':
                    _0x358e69['mat']['B'][0x1][0x2] = 'M';
                    _0x358e69['mat']['B'][0x2][0x2] = 'M';
                    _0x358e69['mat']['L'][0x1][0x0] = 'M';
                    _0x358e69['mat']['L'][0x2][0x0] = 'M';
                    _0x358e69['mat']['D'][0x2][0x0] = 'M';
                    break;
                case 'BR':
                    _0x358e69['mat']['B'][0x1][0x0] = 'M';
                    _0x358e69['mat']['B'][0x2][0x0] = 'M';
                    _0x358e69['mat']['R'][0x1][0x2] = 'M';
                    _0x358e69['mat']['R'][0x2][0x2] = 'M';
                    _0x358e69['mat']['D'][0x2][0x2] = 'M';
                    break;
                }
            }
        }
    }
    static ['maskOLL'](_0x41263b) {
        for (const _0x5e12ca of NxN['faces']) {
            for (let _0x533f88 = 0x0; _0x533f88 < _0x41263b['rank']; _0x533f88++) {
                for (let _0x3a0646 = 0x0; _0x3a0646 < _0x41263b['rank']; _0x3a0646++) {
                    if ('RFLB'['indexOf'](_0x5e12ca[0x0]) != -0x1 && _0x533f88 == 0x0 || _0x5e12ca == 'U') {
                        if (_0x41263b['mat'][_0x5e12ca][_0x533f88][_0x3a0646] != _0x41263b['mat']['U'][0x1][0x1]) {
                            _0x41263b['mat'][_0x5e12ca][_0x533f88][_0x3a0646] = 'M';
                        }
                    }
                }
            }
        }
    }
    static ['maskFRPair'](_0x1007f5) {
        for (const _0x4ce314 of NxN['faces']) {
            _0x1007f5['mat'][_0x4ce314] = [];
            for (let _0x8e59dd = 0x0; _0x8e59dd < _0x1007f5['rank']; _0x8e59dd++) {
                _0x1007f5['mat'][_0x4ce314][_0x8e59dd] = [];
                for (let _0x1d5bd7 = 0x0; _0x1d5bd7 < _0x1007f5['rank']; _0x1d5bd7++) {
                    _0x1007f5['mat'][_0x4ce314][_0x8e59dd]['push']('M');
                }
            }
        }
        _0x1007f5['mat']['D'][0x0][0x2] = 'D';
        _0x1007f5['mat']['F'][0x1][0x2] = 'F';
        _0x1007f5['mat']['F'][0x2][0x2] = 'F';
        _0x1007f5['mat']['R'][0x1][0x0] = 'R';
        _0x1007f5['mat']['R'][0x2][0x0] = 'R';
    }
    static ['translatePairLocationToColor'](_0x226a86) {
        let _0x43ee28 = {
            'U': 'White',
            'D': 'Yellow',
            'F': 'Green',
            'B': 'Blue',
            'R': 'Red',
            'L': 'Orange'
        };
        switch (_0x226a86) {
        case 'FR':
            return _0x43ee28[data['mat']['F'][0x1][0x1]] + '\x20' + _0x43ee28[data['mat']['R'][0x1][0x1]];
        case 'FL':
            return _0x43ee28[data['mat']['F'][0x1][0x1]] + '\x20' + _0x43ee28[data['mat']['L'][0x1][0x1]];
        case 'BR':
            return _0x43ee28[data['mat']['B'][0x1][0x1]] + '\x20' + _0x43ee28[data['mat']['R'][0x1][0x1]];
        case 'BL':
            return _0x43ee28[data['mat']['B'][0x1][0x1]] + '\x20' + _0x43ee28[data['mat']['L'][0x1][0x1]];
        }
        return '';
    }
    static ['getHighlightedReidHash'](_0x334e0f) {
        let _0x44bc86 = this['getNormalizedPuzzle'](_0x334e0f);
        let _0x526484 = this['getReidHash'](_0x334e0f);
        let _0x499219 = {
            'UFR': $('.NxN_model:last\x20.NxN_brick[data-c=202].highlighted')['length'] != 0x0 ? _0x526484['UFR'] : 'NNN',
            'UFL': $('.NxN_model:last\x20.NxN_brick[data-c=002].highlighted')['length'] != 0x0 ? _0x526484['UFL'] : 'NNN',
            'UBR': $('.NxN_model:last\x20.NxN_brick[data-c=200].highlighted')['length'] != 0x0 ? _0x526484['UBR'] : 'NNN',
            'UBL': $('.NxN_model:last\x20.NxN_brick[data-c=000].highlighted')['length'] != 0x0 ? _0x526484['UBL'] : 'NNN',
            'DFR': $('.NxN_model:last\x20.NxN_brick[data-c=222].highlighted')['length'] != 0x0 ? _0x526484['DFR'] : 'NNN',
            'DFL': $('.NxN_model:last\x20.NxN_brick[data-c=022].highlighted')['length'] != 0x0 ? _0x526484['DFL'] : 'NNN',
            'DBR': $('.NxN_model:last\x20.NxN_brick[data-c=220].highlighted')['length'] != 0x0 ? _0x526484['DBR'] : 'NNN',
            'DBL': $('.NxN_model:last\x20.NxN_brick[data-c=020].highlighted')['length'] != 0x0 ? _0x526484['DBL'] : 'NNN',
            'UF': $('.NxN_model:last\x20.NxN_brick[data-c=102].highlighted')['length'] != 0x0 ? _0x526484['UF'] : 'NNN',
            'UR': $('.NxN_model:last\x20.NxN_brick[data-c=201].highlighted')['length'] != 0x0 ? _0x526484['UR'] : 'NNN',
            'UB': $('.NxN_model:last\x20.NxN_brick[data-c=100].highlighted')['length'] != 0x0 ? _0x526484['UB'] : 'NNN',
            'UL': $('.NxN_model:last\x20.NxN_brick[data-c=001].highlighted')['length'] != 0x0 ? _0x526484['UL'] : 'NNN',
            'DF': $('.NxN_model:last\x20.NxN_brick[data-c=122].highlighted')['length'] != 0x0 ? _0x526484['DF'] : 'NNN',
            'DR': $('.NxN_model:last\x20.NxN_brick[data-c=221].highlighted')['length'] != 0x0 ? _0x526484['DR'] : 'NNN',
            'DB': $('.NxN_model:last\x20.NxN_brick[data-c=120].highlighted')['length'] != 0x0 ? _0x526484['DB'] : 'NNN',
            'DL': $('.NxN_model:last\x20.NxN_brick[data-c=021].highlighted')['length'] != 0x0 ? _0x526484['DL'] : 'NNN',
            'FR': $('.NxN_model:last\x20.NxN_brick[data-c=212].highlighted')['length'] != 0x0 ? _0x526484['FR'] : 'NNN',
            'BR': $('.NxN_model:last\x20.NxN_brick[data-c=210].highlighted')['length'] != 0x0 ? _0x526484['BR'] : 'NNN',
            'BL': $('.NxN_model:last\x20.NxN_brick[data-c=010].highlighted')['length'] != 0x0 ? _0x526484['BL'] : 'NNN',
            'FL': $('.NxN_model:last\x20.NxN_brick[data-c=012].highlighted')['length'] != 0x0 ? _0x526484['FL'] : 'NNN'
        };
        return _0x499219;
    }
    static ['getReidHash'](_0x23c875) {
        let _0x53c3e6 = NxN['getNormalizedPuzzle'](_0x23c875);
        return {
            'UFR': _0x53c3e6['mat']['U'][0x2][0x2] + _0x53c3e6['mat']['F'][0x0][0x2] + _0x53c3e6['mat']['R'][0x0][0x0],
            'UFL': _0x53c3e6['mat']['U'][0x2][0x0] + _0x53c3e6['mat']['F'][0x0][0x0] + _0x53c3e6['mat']['L'][0x0][0x2],
            'UBR': _0x53c3e6['mat']['U'][0x0][0x2] + _0x53c3e6['mat']['B'][0x0][0x0] + _0x53c3e6['mat']['R'][0x0][0x2],
            'UBL': _0x53c3e6['mat']['U'][0x0][0x0] + _0x53c3e6['mat']['B'][0x0][0x2] + _0x53c3e6['mat']['L'][0x0][0x0],
            'DFR': _0x53c3e6['mat']['D'][0x0][0x2] + _0x53c3e6['mat']['F'][0x2][0x2] + _0x53c3e6['mat']['R'][0x2][0x0],
            'DFL': _0x53c3e6['mat']['D'][0x0][0x0] + _0x53c3e6['mat']['F'][0x2][0x0] + _0x53c3e6['mat']['L'][0x2][0x2],
            'DBR': _0x53c3e6['mat']['D'][0x2][0x2] + _0x53c3e6['mat']['B'][0x2][0x0] + _0x53c3e6['mat']['R'][0x2][0x2],
            'DBL': _0x53c3e6['mat']['D'][0x2][0x0] + _0x53c3e6['mat']['B'][0x2][0x2] + _0x53c3e6['mat']['L'][0x2][0x0],
            'UF': _0x53c3e6['mat']['U'][0x2][0x1] + _0x53c3e6['mat']['F'][0x0][0x1],
            'UR': _0x53c3e6['mat']['U'][0x1][0x2] + _0x53c3e6['mat']['R'][0x0][0x1],
            'UB': _0x53c3e6['mat']['U'][0x0][0x1] + _0x53c3e6['mat']['B'][0x0][0x1],
            'UL': _0x53c3e6['mat']['U'][0x1][0x0] + _0x53c3e6['mat']['L'][0x0][0x1],
            'DF': _0x53c3e6['mat']['D'][0x0][0x1] + _0x53c3e6['mat']['F'][0x2][0x1],
            'DR': _0x53c3e6['mat']['D'][0x1][0x2] + _0x53c3e6['mat']['R'][0x2][0x1],
            'DB': _0x53c3e6['mat']['D'][0x2][0x1] + _0x53c3e6['mat']['B'][0x2][0x1],
            'DL': _0x53c3e6['mat']['D'][0x1][0x0] + _0x53c3e6['mat']['L'][0x2][0x1],
            'FR': _0x53c3e6['mat']['F'][0x1][0x2] + _0x53c3e6['mat']['R'][0x1][0x0],
            'BR': _0x53c3e6['mat']['B'][0x1][0x0] + _0x53c3e6['mat']['R'][0x1][0x2],
            'BL': _0x53c3e6['mat']['B'][0x1][0x2] + _0x53c3e6['mat']['L'][0x1][0x0],
            'FL': _0x53c3e6['mat']['F'][0x1][0x0] + _0x53c3e6['mat']['L'][0x1][0x2]
        };
    }
    static ['getNotNormalizedReidHash'](_0x53d642) {
        let _0x29493a = _0x53d642;
        return {
            'UFR': _0x29493a['mat']['U'][0x2][0x2] + _0x29493a['mat']['F'][0x0][0x2] + _0x29493a['mat']['R'][0x0][0x0],
            'UFL': _0x29493a['mat']['U'][0x2][0x0] + _0x29493a['mat']['F'][0x0][0x0] + _0x29493a['mat']['L'][0x0][0x2],
            'UBR': _0x29493a['mat']['U'][0x0][0x2] + _0x29493a['mat']['B'][0x0][0x0] + _0x29493a['mat']['R'][0x0][0x2],
            'UBL': _0x29493a['mat']['U'][0x0][0x0] + _0x29493a['mat']['B'][0x0][0x2] + _0x29493a['mat']['L'][0x0][0x0],
            'DFR': _0x29493a['mat']['D'][0x0][0x2] + _0x29493a['mat']['F'][0x2][0x2] + _0x29493a['mat']['R'][0x2][0x0],
            'DFL': _0x29493a['mat']['D'][0x0][0x0] + _0x29493a['mat']['F'][0x2][0x0] + _0x29493a['mat']['L'][0x2][0x2],
            'DBR': _0x29493a['mat']['D'][0x2][0x2] + _0x29493a['mat']['B'][0x2][0x0] + _0x29493a['mat']['R'][0x2][0x2],
            'DBL': _0x29493a['mat']['D'][0x2][0x0] + _0x29493a['mat']['B'][0x2][0x2] + _0x29493a['mat']['L'][0x2][0x0],
            'UF': _0x29493a['mat']['U'][0x2][0x1] + _0x29493a['mat']['F'][0x0][0x1],
            'UR': _0x29493a['mat']['U'][0x1][0x2] + _0x29493a['mat']['R'][0x0][0x1],
            'UB': _0x29493a['mat']['U'][0x0][0x1] + _0x29493a['mat']['B'][0x0][0x1],
            'UL': _0x29493a['mat']['U'][0x1][0x0] + _0x29493a['mat']['L'][0x0][0x1],
            'DF': _0x29493a['mat']['D'][0x0][0x1] + _0x29493a['mat']['F'][0x2][0x1],
            'DR': _0x29493a['mat']['D'][0x1][0x2] + _0x29493a['mat']['R'][0x2][0x1],
            'DB': _0x29493a['mat']['D'][0x2][0x1] + _0x29493a['mat']['B'][0x2][0x1],
            'DL': _0x29493a['mat']['D'][0x1][0x0] + _0x29493a['mat']['L'][0x2][0x1],
            'FR': _0x29493a['mat']['F'][0x1][0x2] + _0x29493a['mat']['R'][0x1][0x0],
            'BR': _0x29493a['mat']['B'][0x1][0x0] + _0x29493a['mat']['R'][0x1][0x2],
            'BL': _0x29493a['mat']['B'][0x1][0x2] + _0x29493a['mat']['L'][0x1][0x0],
            'FL': _0x29493a['mat']['F'][0x1][0x0] + _0x29493a['mat']['L'][0x1][0x2]
        };
    }
    static ['getF2LPairs'](_0x358581, _0x424d55) {
        let _0x4ebf4f = {
            'FR': [],
            'BR': [],
            'FL': [],
            'BL': []
        };
        let _0x1c0e73 = Object['keys'](_0x4ebf4f);
        let _0x11781c = NxN['getReidHash'](_0x358581);
        if (_0x424d55 == !![]) {
            _0x11781c = NxN['getHighlightedReidHash'](_0x358581);
        }
        const _0x4ef6c2 = Object['keys'](_0x11781c);
        for (let _0x195d26 = 0x0; _0x195d26 < _0x4ef6c2['length']; _0x195d26++) {
            const _0x3a9509 = _0x4ef6c2[_0x195d26];
            const _0x2ad179 = _0x11781c[_0x3a9509];
            if (_0x2ad179['indexOf']('U') != -0x1)
                continue;
            if (_0x2ad179['length'] == 0x2 && _0x2ad179['indexOf']('D') != -0x1)
                continue;
            for (let _0x521bf8 = 0x0; _0x521bf8 < _0x1c0e73['length']; _0x521bf8++) {
                let _0x2ae2ba = _0x1c0e73[_0x521bf8];
                if (_0x2ad179['indexOf'](_0x2ae2ba[0x0]) != -0x1 && _0x2ad179['indexOf'](_0x2ae2ba[0x1]) != -0x1) {
                    _0x4ebf4f[_0x2ae2ba]['push']([
                        _0x2ad179,
                        _0x3a9509
                    ]);
                    break;
                }
            }
        }
        return _0x4ebf4f;
    }
    static ['getPairType'](_0x31dc57, _0x47af3a) {
        let _0x39f831 = [];
        let _0x10b772 = NxN['new_NxN_Data'](_0x31dc57);
        let _0x2fa7e3 = 0x0;
        for (let _0x14662b = 0x0; _0x14662b < 0x4; _0x14662b++) {
            if (_0x10b772['mat']['F'][0x1][0x1] != _0x47af3a['mat']['F'][0x1][0x1]) {
                NxN['ProcessMoves'](_0x10b772, 'y');
                _0x2fa7e3++;
            } else
                break;
        }
        _0x2fa7e3 = (0x4 - _0x2fa7e3) % 0x4;
        let _0x357f39 = NxN['getNormalizedHash'](_0x10b772);
        let _0x39f41f = NxN['getNormalizedHash'](_0x47af3a);
        let _0xa71cbf = ![];
        let _0x188d8e = ![];
        let _0x45334d = NxN['hashes']['pair1'];
        for (let _0x569e4a = 0x0; _0x569e4a < _0x45334d['poststage']['length']; _0x569e4a++) {
            _0xa71cbf = ![];
            if (NxN['compareHash'](_0x45334d['poststage'][_0x569e4a]['hash'], _0x45334d['poststage'][_0x569e4a]['mask'], _0x39f41f)) {
                _0xa71cbf = !![];
            }
            _0x188d8e = ![];
            if (NxN['compareHash'](_0x45334d['poststage'][_0x569e4a]['hash'], _0x45334d['poststage'][_0x569e4a]['mask'], _0x357f39)) {
                _0x188d8e = !![];
            }
            let _0x4c313b = {
                'FR': [
                    'FR',
                    'FL',
                    'BL',
                    'BR'
                ],
                'FL': [
                    'FL',
                    'BL',
                    'BR',
                    'FR'
                ],
                'BL': [
                    'BL',
                    'BR',
                    'FR',
                    'FL'
                ],
                'BR': [
                    'BR',
                    'FR',
                    'FL',
                    'BL'
                ]
            };
            if (!_0xa71cbf && _0x188d8e) {
                switch (_0x569e4a) {
                case 0x0:
                    _0x39f831['push']({
                        'color': NxN['translatePairLocationToColor'](_0x10b772, 'FR'),
                        'target': _0x4c313b['FR'][_0x2fa7e3],
                        'origin': 'FR'
                    });
                    break;
                case 0x1:
                    _0x39f831['push']({
                        'color': NxN['translatePairLocationToColor'](_0x10b772, 'FL'),
                        'target': _0x4c313b['FL'][_0x2fa7e3],
                        'origin': 'FL'
                    });
                    break;
                case 0x2:
                    _0x39f831['push']({
                        'color': NxN['translatePairLocationToColor'](_0x10b772, 'BR'),
                        'target': _0x4c313b['BR'][_0x2fa7e3],
                        'origin': 'BR'
                    });
                    break;
                case 0x3:
                    _0x39f831['push']({
                        'color': NxN['translatePairLocationToColor'](_0x10b772, 'BL'),
                        'target': _0x4c313b['BL'][_0x2fa7e3],
                        'origin': 'BL'
                    });
                    break;
                }
            }
        }
        return _0x39f831;
    }
    static ['encodeF2LPair'](_0x1bae28) {
        if (_0x1bae28['length'] != 0x2) {
            return -0x1;
        }
        let _0x51d4f5 = 'UDLRFB';
        let _0x132c9a = 0x0;
        if (_0x1bae28[0x0]['length'] == 0x2) {
            _0x132c9a = _0x1bae28[0x0]['join']('') + _0x1bae28[0x1]['join']('');
        } else {
            _0x132c9a = _0x1bae28[0x1]['join']('') + _0x1bae28[0x0]['join']('');
        }
        let _0x426654 = '';
        for (let _0x5a8285 = 0x0; _0x5a8285 < _0x132c9a['length']; _0x5a8285++) {
            _0x426654 = _0x426654 + _0x51d4f5['indexOf'](_0x132c9a[_0x5a8285]);
        }
        return _0x426654;
    }
    static ['generateF2LHashTable']() {
        let _0x4a3ffb = {
            'F2L\x201': 'R\x27\x20F\x20R\x20F\x27',
            'F2L\x202': 'F\x20R\x27\x20F\x27\x20R',
            'F2L\x203': 'F\x27\x20U\x27\x20F',
            'F2L\x204': 'R\x20U\x20R\x27',
            'F2L\x205': 'U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'F2L\x206': 'U\x20F\x27\x20U\x27\x20F\x20U2\x20F\x27\x20U\x20F',
            'F2L\x207': 'U\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'F2L\x208': 'r\x27\x20U2\x20R2\x20U\x20R2\x27\x20U\x20r',
            'F2L\x209': 'U\x27\x20R\x20U\x27\x20R\x27\x20U\x20F\x27\x20U\x27\x20F',
            'F2L\x2010': 'U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'F2L\x2011': 'U\x27\x20R\x20U2\x20R\x27\x20U\x20F\x27\x20U\x27\x20F',
            'F2L\x2012': 'R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'F2L\x2013': 'M\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20r\x27',
            'F2L\x2014': 'U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'F2L\x2015': 'R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'F2L\x2016': 'R\x20U\x27\x20R\x27\x20U2\x20F\x27\x20U\x27\x20F',
            'F2L\x2017': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F2L\x2018': 'R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'F2L\x2019': 'U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'F2L\x2020': 'U\x27\x20R\x20U\x27\x20R2\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27',
            'F2L\x2021': 'R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'F2L\x2022': 'F\x27\x20L\x27\x20U2\x20L\x20F',
            'F2L\x2023': 'R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F2L\x2024': 'F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x27',
            'F2L\x2025': 'R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F',
            'F2L\x2026': 'U\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x27\x20U\x20F',
            'F2L\x2027': 'R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'F2L\x2028': 'R\x20U\x20R\x27\x20U\x27\x20F\x20R\x27\x20F\x27\x20R',
            'F2L\x2029': 'R\x27\x20F\x20R\x20F\x27\x20R\x27\x20F\x20R\x20F\x27',
            'F2L\x2030': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F2L\x2031': 'U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27',
            'F2L\x2032': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F2L\x2033': 'U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'F2L\x2034': 'U\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'F2L\x2035': 'U\x27\x20R\x20U\x20R\x27\x20U\x20F\x27\x20U\x27\x20F',
            'F2L\x2036': 'U2\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20R\x20U\x20R\x27',
            'F2L\x2037': 'R2\x20U2\x20F\x20R2\x20F\x27\x20U2\x20R\x27\x20U\x20R\x27',
            'F2L\x2038': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F2L\x2039': 'R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'F2L\x2040': 'R\x20U\x27\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x20U\x27\x20R\x27',
            'F2L\x2041': 'R\x20U\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x27',
            'AF2L\x201': 'M\x20F\x27\x20M\x27',
            'AF2L\x201a': 'L\x27\x20U\x27\x20L\x20F\x27\x20U\x27\x20F',
            'AF2L\x202': 'L\x20U\x27\x20L\x27\x20R\x20U2\x20R\x27',
            'AF2L\x202a': 'y\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R\x20y',
            'AF2L\x203': 'R\x27\x20U\x27\x20R2\x20U2\x20R\x27',
            'AF2L\x203a': 'R\x27\x20U\x27\x20R\x20U2\x20F\x27\x20U\x27\x20F',
            'AF2L\x204': 'U2\x20L\x27\x20U\x20L\x20U\x27\x20R\x20U\x20R\x27',
            'AF2L\x204a': 'U\x20L\x27\x20U\x20L\x20y\x27\x20U2\x20R\x27\x20U\x20R\x20y',
            'AF2L\x205': 'L\x20U\x20L\x27\x20U\x20R\x20U\x20R\x27',
            'AF2L\x205a': 'U\x20L\x20U\x20L\x27\x20y\x27\x20R\x27\x20U\x20R\x20y',
            'AF2L\x206': 'U2\x20R\x27\x20U\x20R\x20U\x20R\x20U\x20R\x27',
            'AF2L\x206a': 'U\x20S\x20R\x20S\x27',
            'AF2L\x207': 'U\x27\x20L\x27\x20U\x20L\x20R\x20U\x27\x20R\x27',
            'AF2L\x207a': 'y\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20y',
            'AF2L\x208': 'R\x20D\x27\x20R\x27\x20U\x20R\x20U\x20D\x20R\x27',
            'AF2L\x208a': 'U2\x20L\x20U\x27\x20L\x27\x20y\x20L\x27\x20U2\x20L\x20y\x27',
            'AF2L\x209': 'U\x20R\x27\x20U2\x27\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'AF2L\x209a': 'y\x20U2\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x20L\x20y\x27',
            'AF2L\x2010': 'U\x27\x20L\x20F2\x20L\x27\x20F2',
            'AF2L\x2010a': 'U\x27\x20R\x27\x20D\x27\x20F\x27\x20D\x20R',
            'AF2L\x2011': 'U\x27\x20L\x20U\x27\x20L\x27\x20R\x20U\x27\x20R\x27',
            'AF2L\x2011a': 'U2\x20L\x20F\x27\x20U\x27\x20F\x20L\x27',
            'AF2L\x2012': 'U\x27\x20R\x20U\x20R2\x20U\x27\x20R2\x20U\x20R\x27',
            'AF2L\x2012a': 'U\x20R\x27\x20U2\x20R\x20y\x27\x20R\x27\x20U\x27\x20R\x20y',
            'AF2L\x2013': 'U\x27\x20L\x20F\x27\x20L2\x27\x20U\x20L\x20U2\x27\x20F',
            'AF2L\x2014': 'U2\x20R2\x20D\x20B2\x20D\x27\x20R2',
            'AF2L\x2015': 'U\x27\x20R\x27\x20U\x20R\x20U\x27\x20S\x20R\x20S\x27',
            'AF2L\x2016': 'U\x27\x20R\x27\x20D\x27\x20F\x27\x20D\x20R',
            'AF2L\x2017': 'U2\x20L\x20F\x27\x20U\x27\x20F\x20L\x27',
            'AF2L\x2018': 'U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20F\x27\x20U\x27\x20F',
            'AF2L\x2019': 'U\x27\x20F\x20U2\x27\x20F\x27\x20R\x20U\x20R\x27',
            'AF2L\x2020': 'U\x20L\x20U\x20L\x27\x20R\x20U\x20R\x27',
            'AF2L\x2021': 'U\x20R\x27\x20U\x20R\x20U\x27\x20F\x27\x20U\x20F',
            'AF2L\x2022': 'R\x20L\x27\x20U2\x20L\x20R\x27',
            'AF2L\x2023': 'F\x27\x20L\x20U\x27\x20L\x27\x20F',
            'AF2L\x2024': 'R\x27\x20U\x20R2\x20U\x27\x20R\x27',
            'AF2L\x2025': 'F\x20R\x20U\x27\x20R2\x20F\x27\x20R',
            'AF2L\x2026': 'L\x20R\x20U2\x27\x20R\x27\x20L\x27',
            'AF2L\x2027': 'R\x27\x20U\x20R\x20U\x20F\x27\x20U\x27\x20F',
            'AF2L\x2028': 'L\x27\x20U\x20L\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'AF2L\x2029': 'B\x27\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27\x20B',
            'AF2L\x2030': 'R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'AF2L\x2031': 'L\x27\x20U\x20L\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'AF2L\x2032': 'L\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20b\x27\x20R\x27\x20b',
            'AF2L\x2033': 'R\x27\x20U\x20R\x20U\x20R\x20U\x27\x20R\x27\x20B\x20U\x20B\x27\x20R\x20U2\x27\x20R\x27',
            'AF2L\x2034': 'F\x20U\x27\x20F\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27',
            'AF2L\x2035': 'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20R\x20U\x27\x20R\x27',
            'AF2L\x2036': 'R\x27\x20U\x27\x20R\x20U2\x27\x20R\x27\x20U\x20R\x20b\x27\x20R\x27\x20b',
            'AF2L\x2037': 'L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L\x20F\x27\x20U2\x20F',
            'AF2L\x2038': 'L\x20U\x20L\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'AF2L\x2039': 'B\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20B\x27',
            'AF2L\x2040': 'L\x20U\x20L2\x27\x20U\x20L2\x20U2\x20L\x27\x20R\x20U\x27\x20R\x27',
            'AF2L\x2041': 'L\x27\x20B\x20L\x20B\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20R\x20U\x27\x20R\x27',
            'AF2L\x2042': 'R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R2\x20U\x20R\x27'
        };
        let _0x5e6cc8 = [
            'FR',
            'FL',
            'BL',
            'BR'
        ];
        for (let _0x2ed06e = 0x0; _0x2ed06e < 0x4; _0x2ed06e++) {
            let _0x2c5f28 = [];
            let _0x14d0e7 = Object['keys'](_0x4a3ffb);
            for (let _0x18ed5b = 0x0; _0x18ed5b < _0x14d0e7['length']; _0x18ed5b++) {
                let _0x189e7b = _0x4a3ffb[_0x14d0e7[_0x18ed5b]];
                let _0x24970d = new new_NxN_Data(0x3);
                let _0x13f348 = NxN_AlgHandler['InvertMoves'](_0x189e7b);
                ProcessMoves(_0x24970d, _0x13f348);
                for (let _0x43107b = 0x0; _0x43107b < _0x2ed06e; _0x43107b++)
                    ProcessMoves(_0x24970d, 'y');
                for (let _0x4dbfde = 0x0; _0x4dbfde < 0x4; _0x4dbfde++) {
                    let _0x154581 = _0x14d0e7[_0x18ed5b];
                    let _0x1dd4e7 = NxN['encodeF2LPair'](_0x24970d['getF2LPairs']()[_0x5e6cc8[_0x2ed06e]]);
                    if (!_0x2c5f28['hasOwnProperty'](_0x1dd4e7)) {
                        _0x2c5f28[_0x1dd4e7] = [];
                    }
                    _0x2c5f28[_0x1dd4e7]['push']([
                        _0x154581,
                        _0x4dbfde
                    ]);
                    ProcessMoves(_0x24970d, 'U');
                }
            }
            let _0x1a7c62 = Object['keys'](_0x2c5f28);
            let _0x458d7f = '{';
            for (let _0x1cf25c = 0x0; _0x1cf25c < _0x1a7c62['length']; _0x1cf25c++) {
                _0x458d7f += '\x22' + _0x1a7c62[_0x1cf25c] + '\x22:{\x22name\x22:\x22' + _0x2c5f28[_0x1a7c62[_0x1cf25c]][0x0][0x0] + '\x22,\x20\x22orientation\x22:\x20' + _0x2c5f28[_0x1a7c62[_0x1cf25c]][0x0][0x1] + '},';
            }
            _0x458d7f += '}';
            console['log'](_0x5e6cc8[_0x2ed06e]);
            console['log'](_0x458d7f);
        }
    }
    static ['generateCMLLHashTable']() {
        let _0x1dcab = {
            'O\x20Adjacent': 'R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27',
            'O\x20Diagonal': 'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27',
            'H\x20Columns': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'H\x20Rows': 'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'H\x20Column': 'U\x20F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'H\x20Row': 'U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20r\x27\x20F\x20R\x27\x20F\x27\x20r',
            'Pi\x20Right\x20Bar': 'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'Pi\x20Down\x20Slash': 'U\x20F\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x27\x20R\x27',
            'Pi\x20X': 'U\x27\x20R\x27\x20F\x20R\x20U\x20F\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'Pi\x20Up\x20Slash': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R\x27\x20F\x20R\x20F\x27',
            'Pi\x20Columns': 'U\x27\x20r\x20U\x27\x20r2\x27\x20D\x27\x20r\x20U\x20r\x27\x20D\x20r2\x20U\x20r\x27',
            'Pi\x20Left\x20Bar': 'U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'U\x20Up\x20Slash': 'U2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'U\x20Down\x20Slash': 'R2\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
            'U\x20Bottom\x20Row': 'R2\x27\x20F\x20U\x27\x20F\x20U\x20F2\x20R2\x20U\x27\x20R\x27\x20F\x20R',
            'U\x20Rows': 'U\x27\x20F\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x27\x20U\x27\x20F\x27',
            'U\x20X': 'U2\x20r\x20U\x27\x20r\x27\x20U\x20r\x27\x20D\x27\x20r\x20U\x27\x20r\x27\x20D\x20r',
            'U\x20Upper\x20Row': 'U\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'T\x20Left\x20Bar': 'U\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
            'T\x20Right\x20Bar': 'U\x20l\x27\x20U\x27\x20L\x20U\x20l\x20F\x27\x20L\x27\x20F',
            'T\x20Rows': 'F\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2',
            'T\x20Bottom\x20Row': 'r\x27\x20U\x20r\x20U2\x27\x20R2\x27\x20F\x20R\x20F\x27\x20R',
            'T\x20Top\x20Row': 'r\x27\x20D\x27\x20r\x20U\x20r\x27\x20D\x20r\x20U\x27\x20r\x20U\x20r\x27',
            'T\x20Columns': 'R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x27\x20U\x27\x20R',
            'Sune\x20Left\x20Bar': 'U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'Sune\x20X': 'U\x20L\x27\x20U2\x20L\x20U2\x27\x20L\x20F\x27\x20L\x27\x20F',
            'Sune\x20Up\x20Slash': 'U\x20F\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x27\x20R\x27',
            'Sune\x20Columns': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x27',
            'Sune\x20Right\x20Bar': 'U\x27\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U2\x27\x20R\x27',
            'Sune\x20Down\x20Slash': 'U\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'Anti\x20Sune\x20Right\x20Bar': 'U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x27\x20R',
            'Anti\x20Sune\x20Columns': 'U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'Anti\x20Sune\x20Down\x20Slash': 'U\x27\x20F\x27\x20L\x20F\x20L\x27\x20U2\x27\x20L\x27\x20U2\x20L',
            'Anti\x20Sune\x20X': 'U\x27\x20R\x20U2\x27\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27',
            'Anti\x20Sune\x20Up\x20Slash': 'U\x27\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x20R\x27',
            'Anti\x20Sune\x20Left\x20Bar': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R',
            'L\x20Best': 'R2\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R',
            'L\x20Good': 'U2\x20F\x20R\x27\x20F\x27\x20r\x20U\x20R\x20U\x27\x20r\x27',
            'L\x20Pure': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'L\x20Front\x20Commutator': 'R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27',
            'L\x20Diagonal': 'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2',
            'L\x20Back\x20Commutator': 'U\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2'
        };
        let _0x712786 = [];
        let _0x1fdfa7 = Object['keys'](_0x1dcab);
        for (let _0x3c4daa = 0x0; _0x3c4daa < _0x1fdfa7['length']; _0x3c4daa++) {
            let _0x8e4825 = _0x1dcab[_0x1fdfa7[_0x3c4daa]];
            for (let _0x313620 = 0x0; _0x313620 < 0x4; _0x313620++) {
                let _0x1f3ce7 = new_NxN_Data(0x3);
                for (let _0x5ccaa1 = 0x0; _0x5ccaa1 < _0x313620; _0x5ccaa1++)
                    ProcessMoves(_0x1f3ce7, 'y');
                let _0x12b1e2 = NxN_AlgHandler['InvertMoves'](_0x8e4825);
                ProcessMoves(_0x1f3ce7, _0x12b1e2);
                for (let _0x33a77c = 0x0; _0x33a77c < 0x4; _0x33a77c++) {
                    let _0x4a00bc = _0x1fdfa7[_0x3c4daa];
                    let _0x2a2f97 = getCMLLHash(_0x1f3ce7);
                    if (!_0x712786['hasOwnProperty'](pllhash)) {
                        _0x712786[_0x2a2f97] = [];
                    }
                    _0x712786[_0x2a2f97]['push']([
                        _0x4a00bc,
                        _0x33a77c
                    ]);
                    ProcessMoves(_0x1f3ce7, 'U');
                }
            }
        }
        let _0x17ba9f = Object['keys'](_0x712786);
        let _0x5daf9c = '{';
        for (let _0x1d1532 = 0x0; _0x1d1532 < _0x17ba9f['length']; _0x1d1532++) {
            _0x5daf9c += '\x22' + _0x17ba9f[_0x1d1532] + '\x22:{\x22name\x22:\x22' + _0x712786[_0x17ba9f[_0x1d1532]][0x0][0x0] + '\x22,\x20\x22orientation\x22:\x20' + _0x712786[_0x17ba9f[_0x1d1532]][0x0][0x1] + '},';
        }
        _0x5daf9c += '}';
        console['log'](_0x712786);
        console['log'](_0x5daf9c);
    }
    static ['generatePLLHashTable']() {
        let _0x18fc78 = {
            'Aa': ['x\x20R\x27\x20U\x20R\x27\x20D2\x20R\x20U\x27\x20R\x27\x20D2\x20R2\x20x\x27'],
            'Ab': [
                'x\x20R2\x20D2\x20R\x20U\x20R\x27\x20D2\x20R\x20U\x27\x20R\x20x\x27',
                'l\x27\x20R\x27\x20D2\x20R\x20U\x20R\x27\x20D2\x20R\x20U\x27\x20l',
                'y\x20x\x27\x20R\x20U\x27\x20R\x20D2\x20R\x27\x20U\x20R\x20D2\x20R2\x20x'
            ],
            'E': ['R2\x20U\x20R\x27\x20U\x27\x20y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20y\x27\x20R\x20U\x27\x20R2'],
            'F': [
                'R\x27\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20U\x27\x20F\x20U\x20R\x20F\x20R\x27\x20F\x27\x20R2',
                'y\x20R2\x27\x20F\x20R\x20F\x27\x20R\x27\x20U\x27\x20F\x27\x20U\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20R'
            ],
            'Ga': [
                'R2\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x20U\x27\x20R\x27\x20U\x20R\x20D\x27',
                'R2\x20u\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20u\x27\x20R2\x20F\x27\x20U\x20F',
                'D\x27\x20R2\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U\x27\x20D\x20R\x27\x20U\x20R'
            ],
            'Gb': [
                'R\x27\x20U\x27\x20R\x20U\x20D\x27\x20R2\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x27\x20R2\x20D',
                'y\x20F\x27\x20U\x27\x20F\x20R2\x20u\x20R\x27\x20U\x20R\x20U\x27\x20R\x20u\x27\x20R2',
                'D\x20R\x27\x20U\x27\x20R\x20U\x20D\x27\x20R2\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x27\x20R2'
            ],
            'Gc': [
                'R2\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x27\x20U\x20R\x20U\x27\x20R\x27\x20D',
                'y2\x20R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2',
                'R2\x27\x20u\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20u\x20R2\x20f\x20R\x27\x20f\x27'
            ],
            'Gd': [
                'R\x20U\x20R\x27\x20U\x27\x20D\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R2\x20D\x27',
                'R\x20U\x20R\x27\x20y\x27\x20R2\x20u\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20u\x20R2',
                'D\x27\x20R\x20U\x20R\x27\x20U\x27\x20D\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R2'
            ],
            'H': [
                'M2\x20U\x27\x20M2\x20U2\x20M2\x20U\x27\x20M2',
                'M2\x20U\x20M2\x20U2\x20M2\x20U\x20M2'
            ],
            'Ja': ['L\x27\x20U\x27\x20L\x20F\x20L\x27\x20U\x27\x20L\x20U\x20L\x20F\x27\x20L2\x20U\x20L'],
            'Jb': [
                'R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27',
                'R\x20U\x27\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20U2\x27\x20R\x27',
                'R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L'
            ],
            'Na': [
                'F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20R\x27',
                'R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27'
            ],
            'Nb': [
                'r\x27\x20D\x27\x20F\x20r\x20U\x27\x20r\x27\x20F\x27\x20D\x20r2\x20U\x20r\x27\x20U\x27\x20r\x27\x20F\x20r\x20F\x27',
                'R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20F\x20R\x20U\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x27\x20R',
                'R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x27\x20L\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x27\x20L'
            ],
            'Ra': ['L\x20U2\x20L\x27\x20U2\x20L\x20F\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x20F\x20L2'],
            'Rb': [
                'R\x27\x20U2\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R2',
                'y\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R',
                'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R'
            ],
            'T': [
                'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
                'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x20F\x27\x20L\x27\x20U\x20L'
            ],
            'Ua': [
                'R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
                'y2\x20M2\x20U\x20M\x20U2\x20M\x27\x20U\x20M2',
                'M2\x20U\x20M\x27\x20U2\x20M\x20U\x20M2',
                'y\x20R2\x20U\x27\x20S\x27\x20U2\x27\x20S\x20U\x27\x20R2'
            ],
            'Ub': [
                'R\x27\x20U\x20R\x27\x20U\x27\x20R3\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R2',
                'y2\x20M2\x20U\x27\x20M\x20U2\x20M\x27\x20U\x27\x20M2',
                'M2\x20U\x27\x20M\x27\x20U2\x20M\x20U\x27\x20M2',
                'y2\x20R2\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x27'
            ],
            'V': [
                'R\x27\x20U\x20R\x27\x20U\x27\x20y\x20R\x27\x20F\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F',
                'R\x27\x20U\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20D\x20R\x27\x20U\x20D\x27\x20R2\x20U\x27\x20R2\x27\x20D\x20R2',
                'y\x20R\x20U\x27\x20R\x20U\x20R\x27\x20D\x20R\x20D\x27\x20R\x20U\x27\x20D\x20R2\x20U\x20R2\x20D\x27\x20R2'
            ],
            'Y': [
                'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27',
                'F\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
            ],
            'Z': [
                'M2\x20U\x20M2\x20U\x20M\x27\x20U2\x20M2\x20U2\x20M\x27',
                'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R2\x20U\x27\x20R\x27'
            ]
        };
        let _0x338a3b = [];
        let _0x33e217 = Object['keys'](_0x18fc78);
        for (let _0x361415 = 0x0; _0x361415 < _0x33e217['length']; _0x361415++) {
            let _0x569c91 = _0x18fc78[_0x33e217[_0x361415]][0x0];
            for (let _0xbf0d30 = 0x0; _0xbf0d30 < 0x4; _0xbf0d30++) {
                let _0x2c649c = new_NxN_Data(0x3);
                for (let _0x37d2d8 = 0x0; _0x37d2d8 < _0xbf0d30; _0x37d2d8++)
                    ProcessMoves(_0x2c649c, 'y');
                let _0x3645e5 = NxN_AlgHandler['InvertMoves'](_0x569c91);
                ProcessMoves(_0x2c649c, _0x3645e5);
                for (let _0x3b83b7 = 0x0; _0x3b83b7 < 0x4; _0x3b83b7++) {
                    let _0xb83d0e = _0x33e217[_0x361415];
                    let _0x2b31fd = getNewPLLHash(_0x2c649c);
                    if (!_0x338a3b['hasOwnProperty'](_0x2b31fd)) {
                        _0x338a3b[_0x2b31fd] = [];
                    }
                    _0x338a3b[_0x2b31fd]['push']([
                        _0xb83d0e,
                        _0x3b83b7
                    ]);
                    ProcessMoves(_0x2c649c, 'U');
                }
            }
        }
        let _0x477680 = Object['keys'](_0x338a3b);
        let _0x585b74 = '{';
        for (let _0xa82787 = 0x0; _0xa82787 < _0x477680['length']; _0xa82787++) {
            _0x585b74 += '\x22' + _0x477680[_0xa82787] + '\x22:{\x22name\x22:\x22' + _0x338a3b[_0x477680[_0xa82787]][0x0][0x0] + '\x22,\x20\x22orientation\x22:\x20' + _0x338a3b[_0x477680[_0xa82787]][0x0][0x1] + '},';
        }
        _0x585b74 += '}';
        console['log'](_0x338a3b);
        console['log'](_0x585b74);
    }
    static ['generateCOLLHashTable']() {
        let _0x4ae2f1 = {
            'L\x201': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'L\x202': 'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'L\x203': 'y\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
            'L\x204': 'y2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27',
            'L\x205': 'y2\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R',
            'L\x206': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2',
            'U\x201': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'U\x202': 'R\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R',
            'U\x203': 'y2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'U\x204': 'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'U\x205': 'R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
            'U\x206': 'R\x27\x20U2\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
            'T\x201': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'T\x202': 'R\x27\x20U\x20R\x20U2\x20R\x27\x20L\x27\x20U\x20R\x20U\x27\x20L',
            'T\x203': 'y\x20l\x27\x20U\x27\x20L\x20U\x20R\x20U\x27\x20r\x27\x20F',
            'T\x204': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
            'T\x205': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
            'T\x206': 'R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U\x27\x20R',
            'Pi\x201': 'R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
            'Pi\x202': 'R\x27\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U\x27\x20R\x20U\x27\x20R\x27',
            'Pi\x203': 'R\x27\x20U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U2\x20R\x27\x20U2\x20R',
            'Pi\x204': 'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'Pi\x205': 'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
            'Pi\x206': 'R\x20U\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U2\x20R',
            'H\x201': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'H\x202': 'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'H\x203': 'R\x20U\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'H\x204': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
        };
        let _0x53ae2d = [];
        let _0x441b88 = Object['keys'](_0x4ae2f1);
        for (let _0x32cc91 = 0x0; _0x32cc91 < _0x441b88['length']; _0x32cc91++) {
            let _0x3670ad = _0x4ae2f1[_0x441b88[_0x32cc91]];
            for (let _0xf0bedf = 0x0; _0xf0bedf < 0x4; _0xf0bedf++) {
                let _0xeb0a4a = new_NxN_Data(0x3);
                for (let _0x261ab9 = 0x0; _0x261ab9 < _0xf0bedf; _0x261ab9++)
                    ProcessMoves(_0xeb0a4a, 'y');
                let _0x5d8e2f = NxN_AlgHandler['InvertMoves'](_0x3670ad);
                ProcessMoves(_0xeb0a4a, _0x5d8e2f);
                for (let _0x4a3b0f = 0x0; _0x4a3b0f < 0x4; _0x4a3b0f++) {
                    let _0x4e9ae3 = _0x441b88[_0x32cc91];
                    let _0x1435cb = _0xeb0a4a['getCOLLHash']();
                    if (!_0x53ae2d['hasOwnProperty'](_0x1435cb)) {
                        _0x53ae2d[_0x1435cb] = [];
                    }
                    _0x53ae2d[_0x1435cb]['push']([
                        _0x4e9ae3,
                        _0x4a3b0f
                    ]);
                    ProcessMoves(_0xeb0a4a, 'U');
                }
            }
        }
        let _0x340c69 = Object['keys'](_0x53ae2d);
        let _0x43d4e7 = '{';
        for (let _0x4c91ae = 0x0; _0x4c91ae < _0x340c69['length']; _0x4c91ae++) {
            _0x43d4e7 += '\x22' + _0x340c69[_0x4c91ae] + '\x22:{\x22name\x22:\x22' + _0x53ae2d[_0x340c69[_0x4c91ae]][0x0][0x0] + '\x22,\x20\x22orientation\x22:\x20' + _0x53ae2d[_0x340c69[_0x4c91ae]][0x0][0x1] + '},';
        }
        _0x43d4e7 += '}';
        console['log'](_0x53ae2d);
        console['log'](_0x43d4e7);
    }
    static ['generateZBLLHashTable']() {
        let _0x1d9ba2 = {
            'ZBLL\x20AS\x201': 'y\x27\x20R\x20U\x20R\x27\x20B\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20B\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20AS\x202': 'R\x20U2\x20R2\x20F2\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20F2\x20U\x20R',
            'ZBLL\x20AS\x203': 'R\x27\x20U\x27\x20R\x20U\x20R2\x20U\x20L\x20U\x27\x20R2\x20U\x20L\x27\x20U\x20R\x27\x20U2\x20R',
            'ZBLL\x20AS\x204': 'F2\x20R2\x20u\x27\x20L\x20F2\x20L\x27\x20u\x20R2\x20F\x20U2\x20F',
            'ZBLL\x20AS\x205': 'y2\x20R\x27\x20F\x20U2\x20F\x27\x20R\x20F\x20R\x27\x20U2\x20R\x20F\x27',
            'ZBLL\x20AS\x206': 'R\x27\x20U\x20L\x20U\x27\x20R2\x20z\x27\x20R2\x20U\x27\x20L\x20U\x20R2\x20U\x27\x20D\x27\x20z',
            'ZBLL\x20AS\x207': 'y\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x27\x20U2\x20R\x27\x20U2\x20R2\x20U2\x20R\x20U2\x20F\x20R2\x20F\x27',
            'ZBLL\x20AS\x208': 'y\x20R\x20U\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x20L\x20U2\x20R\x27\x20U\x20L\x27\x20U\x20L',
            'ZBLL\x20AS\x209': 'y\x20R\x20U\x20R\x27\x20U2\x20L\x27\x20U2\x20R\x20U2\x20L\x20U\x20L\x27\x20R\x27\x20U2\x20L',
            'ZBLL\x20AS\x2010': 'y\x20R\x27\x20U\x20L\x20U\x27\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x20L\x20U\x27\x20R\x20U2\x20L\x27',
            'ZBLL\x20AS\x2011': 'y2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2012': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2',
            'ZBLL\x20AS\x2013': 'R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R',
            'ZBLL\x20AS\x2014': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2015': 'y2\x20R\x20U2\x20R\x27\x20U2\x20L\x27\x20U\x20R\x20U\x27\x20M\x27\x20x\x27',
            'ZBLL\x20AS\x2016': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20L',
            'ZBLL\x20AS\x2017': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20F\x27\x20U\x20R',
            'ZBLL\x20AS\x2018': 'R\x27\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x27\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27',
            'ZBLL\x20AS\x2019': 'R\x20U\x27\x20L\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27',
            'ZBLL\x20AS\x2020': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2',
            'ZBLL\x20AS\x2021': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'ZBLL\x20AS\x2022': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R2\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2023': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20R',
            'ZBLL\x20AS\x2024': 'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R2',
            'ZBLL\x20AS\x2025': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
            'ZBLL\x20AS\x2026': 'y2\x20R\x27\x20U2\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20U2\x20R',
            'ZBLL\x20AS\x2027': 'R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20AS\x2028': 'y\x20R\x20U2\x20R\x20D\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20D\x27\x20R2',
            'ZBLL\x20AS\x2029': 'y2\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20AS\x2030': 'R\x27\x20U\x20L\x20U\x27\x20R\x20U\x20L\x27',
            'ZBLL\x20AS\x2031': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
            'ZBLL\x20AS\x2032': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R',
            'ZBLL\x20AS\x2033': 'y2\x20L\x27\x20U\x20R\x20U\x27\x20L\x20R\x20U\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R2',
            'ZBLL\x20AS\x2034': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x20F2\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20F2\x20R2',
            'ZBLL\x20AS\x2035': 'y\x27\x20L\x20U\x20D\x27\x20L\x20U\x27\x20L\x27\x20U2\x20D\x20L2\x20U\x27\x20L\x20U\x20L',
            'ZBLL\x20AS\x2036': 'y2\x20R\x27\x20U\x27\x20R\x20F2\x20R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F2',
            'ZBLL\x20AS\x2037': 'L\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2038': 'y\x27\x20R\x20U2\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2039': 'x\x27\x20M\x27\x20U\x27\x20R\x20U\x20L\x27\x20U2\x20R\x27\x20U2\x20R',
            'ZBLL\x20AS\x2040': 'y\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20AS\x2041': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R',
            'ZBLL\x20AS\x2042': 'y\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U\x20R\x20U\x27\x20L\x20R\x27',
            'ZBLL\x20AS\x2043': 'y2\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2044': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U2\x20R\x20U\x27\x20L',
            'ZBLL\x20AS\x2045': 'R\x20U2\x20R\x27\x20U\x20R\x20U\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2046': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20L\x20U\x27\x20R2\x20U\x20L\x27\x20U2\x20R',
            'ZBLL\x20AS\x2047': 'y2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2048': 'y\x20F\x20R\x20U\x20R2\x20U2\x20R2\x20U\x20R2\x20U\x20R\x20F\x27',
            'ZBLL\x20AS\x2049': 'R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2050': 'y\x27\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
            'ZBLL\x20AS\x2051': 'y2\x20F\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20AS\x2052': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U2\x20R',
            'ZBLL\x20AS\x2053': 'y2\x20R\x27\x20U\x27\x20R2\x20U\x27\x20L\x20U2\x20R\x27\x20U\x20R\x20U2\x20R2\x20L\x27\x20U2\x20R',
            'ZBLL\x20AS\x2054': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20L\x27\x20U\x20L\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U2\x20L',
            'ZBLL\x20AS\x2055': 'y\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20AS\x2056': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U2\x20R\x27',
            'ZBLL\x20AS\x2057': 'y\x20R\x20U\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U2\x20L\x20U2\x20L\x27\x20R\x27\x20U2\x20L',
            'ZBLL\x20AS\x2058': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x27\x20F\x27',
            'ZBLL\x20AS\x2059': 'y2\x20R\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R2',
            'ZBLL\x20AS\x2060': 'y\x20L\x20R\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x27\x20U\x20L\x20U\x27\x20R2\x20U\x20R\x27\x20U\x20L\x27',
            'ZBLL\x20AS\x2061': 'y\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R2\x20U\x20R2\x20U\x27\x20R\x27\x20U\x20R2\x20U\x20R2',
            'ZBLL\x20AS\x2062': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20AS\x2063': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R2',
            'ZBLL\x20AS\x2064': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20AS\x2065': 'R\x27\x20U\x27\x20R2\x20U\x20R2\x20U\x20R2\x20U2\x20R2\x20U2\x20R',
            'ZBLL\x20AS\x2066': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2067': 'R\x20U2\x20R2\x20U2\x20R2\x20U\x20R2\x20U\x20R2\x20U\x27\x20R\x27',
            'ZBLL\x20AS\x2068': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20AS\x2069': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20AS\x2070': 'R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U\x20R\x20U\x20R2',
            'ZBLL\x20AS\x2071': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20AS\x2072': 'y\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2',
            'ZBLL\x20H\x201': 'y\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20H\x202': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27',
            'ZBLL\x20H\x203': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R',
            'ZBLL\x20H\x204': 'y\x27\x20R\x20U2\x20R2\x20F\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20F\x27\x20U\x20R',
            'ZBLL\x20H\x205': 'y\x27\x20R\x20B\x27\x20R\x27\x20B\x20U2\x20R2\x20F\x27\x20r\x20U\x27\x20r\x27\x20F2\x20R2',
            'ZBLL\x20H\x206': 'y\x27\x20R\x20U\x27\x20R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U\x27\x20R\x20U2\x20R\x27',
            'ZBLL\x20H\x207': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20H\x208': 'y2\x20F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20H\x209': 'R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R',
            'ZBLL\x20H\x2010': 'y\x27\x20R\x27\x20U2\x20R\x20U2\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20U\x20R',
            'ZBLL\x20H\x2011': 'y\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20H\x2012': 'F\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20F\x27',
            'ZBLL\x20H\x2013': 'y2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
            'ZBLL\x20H\x2014': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20H\x2015': 'y2\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20U\x27\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'ZBLL\x20H\x2016': 'y\x27\x20R\x20U2\x20R2\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R',
            'ZBLL\x20H\x2017': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27',
            'ZBLL\x20H\x2018': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R2\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'ZBLL\x20H\x2019': 'D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x20U\x20R\x20U\x27\x20R2',
            'ZBLL\x20H\x2020': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20H\x2021': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27',
            'ZBLL\x20H\x2022': 'R\x20U\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'ZBLL\x20H\x2023': 'y\x20R\x27\x20F\x20R\x27\x20F\x27\x20R2\x20U\x27\x20r\x27\x20U\x20r\x20U\x27\x20r\x27\x20U\x27\x20r',
            'ZBLL\x20H\x2024': 'y\x27\x20l\x20U\x27\x20R\x20U\x20R\x27\x20l\x27\x20U\x20r\x20U\x27\x20r\x27\x20U\x20r\x20U\x20r\x27',
            'ZBLL\x20H\x2025': 'F\x20U\x27\x20R2\x20U\x20R\x20U2\x20R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20F\x27',
            'ZBLL\x20H\x2026': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20H\x2027': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20H\x2028': 'x\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F2\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20x',
            'ZBLL\x20H\x2029': 'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20H\x2030': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20H\x2031': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20L\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27',
            'ZBLL\x20H\x2032': 'y\x27\x20R\x20U\x20R\x27\x20U\x20y\x27\x20R\x27\x20U\x20R\x20U\x27\x20R2\x20F\x20R\x20F\x27\x20R',
            'ZBLL\x20H\x2033': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20H\x2034': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20H\x2035': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20H\x2036': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20H\x2037': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20H\x2038': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20H\x2039': 'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20H\x2040': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20L\x201': 'y\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x202': 'y\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20L\x203': 'y\x27\x20R\x27\x20U2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x20R',
            'ZBLL\x20L\x204': 'R\x27\x20U2\x20R\x27\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2',
            'ZBLL\x20L\x205': 'R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U2\x20R',
            'ZBLL\x20L\x206': 'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'ZBLL\x20L\x207': 'R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20y\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20L\x208': 'y\x20R\x20U2\x20R\x27\x20F\x20U2\x20F\x27\x20U\x27\x20R\x20F\x20U\x27\x20F\x27\x20U2\x20R\x27',
            'ZBLL\x20L\x209': 'R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20D\x27\x20U\x27\x20R\x27\x20U\x20R\x27',
            'ZBLL\x20L\x2010': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2011': 'R\x27\x20U\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20L\x2012': 'y\x27\x20R\x20U\x27\x20R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U2\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2013': 'y2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20B2\x20R\x27\x20U2\x20R\x20U2\x20R\x20B2\x20R2',
            'ZBLL\x20L\x2014': 'y\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R',
            'ZBLL\x20L\x2015': 'L\x20U\x27\x20R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2016': 'R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x27\x20R\x27\x20U2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20L\x2017': 'y\x27\x20R\x20U2\x20R2\x20U\x20L\x20U\x27\x20L\x27\x20R\x20U2\x20R\x20U\x20L\x20U2\x20L\x27\x20R\x27',
            'ZBLL\x20L\x2018': 'x\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x27\x20D\x27\x20x',
            'ZBLL\x20L\x2019': 'y\x27\x20R\x27\x20U2\x20R\x20U2\x20D\x27\x20R\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R2\x20D',
            'ZBLL\x20L\x2020': 'R\x20F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20F\x27\x20R\x27',
            'ZBLL\x20L\x2021': 'y\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'ZBLL\x20L\x2022': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U\x20R\x20U\x27\x20M\x27\x20x\x27',
            'ZBLL\x20L\x2023': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20L\x2024': 'F\x27\x20r\x27\x20F\x20r\x20U\x20r\x27\x20F2\x20r\x20U\x20F',
            'ZBLL\x20L\x2025': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R2',
            'ZBLL\x20L\x2026': 'y\x27\x20R\x27\x20U\x20L\x27\x20U\x27\x20L\x20R\x20U2\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
            'ZBLL\x20L\x2027': 'R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27',
            'ZBLL\x20L\x2028': 'y2\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20U2\x20R\x20U\x20R\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20L\x2029': 'y2\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R',
            'ZBLL\x20L\x2030': 'y\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20L\x2031': 'y\x20R\x27\x20L\x27\x20U\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20L\x2032': 'y\x20R\x27\x20U\x27\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20L\x2033': 'y2\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2034': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2035': 'R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20L\x2036': 'y\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20L\x2037': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'ZBLL\x20L\x2038': 'y2\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
            'ZBLL\x20L\x2039': 'R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'ZBLL\x20L\x2040': 'y\x20R\x20U2\x20R\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2',
            'ZBLL\x20L\x2041': 'y\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
            'ZBLL\x20L\x2042': 'y\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U2\x20R\x27',
            'ZBLL\x20L\x2043': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20L\x2044': 'y\x27\x20R\x20U\x20R\x27\x20F\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20F\x20R\x27\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20L\x2045': 'y\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'ZBLL\x20L\x2046': 'y\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R',
            'ZBLL\x20L\x2047': 'y\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20D\x20R\x20U\x27\x20R',
            'ZBLL\x20L\x2048': 'L\x27\x20U\x20L2\x20F2\x20L\x27\x20U2\x20L\x27\x20U2\x20L\x20F2\x20U2\x20L\x27\x20U\x20L',
            'ZBLL\x20L\x2049': 'y\x20r\x20U2\x20r2\x20F\x20R\x20F\x27\x20r2\x20R\x27\x20U2\x20r\x27',
            'ZBLL\x20L\x2050': 'R\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U\x20M\x27\x20x\x27\x20U\x20L\x27\x20U\x20L',
            'ZBLL\x20L\x2051': 'y\x27\x20L\x27\x20U2\x20L\x20U\x20R\x20U2\x20L\x27\x20U\x27\x20M\x27\x20x\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2052': 'r\x20U2\x20R\x20r2\x20F\x20R\x27\x20F\x27\x20r2\x20U2\x20r\x27',
            'ZBLL\x20L\x2053': 'r\x20U\x20M\x20U\x20R\x27\x20U\x27\x20r\x20U\x27\x20r\x27\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20L\x2054': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20r\x20U\x20r\x27\x20U\x20R\x20U\x27\x20M\x27\x20U\x27\x20r\x27',
            'ZBLL\x20L\x2055': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2',
            'ZBLL\x20L\x2056': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20U\x20R',
            'ZBLL\x20L\x2057': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2',
            'ZBLL\x20L\x2058': 'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20L\x2059': 'y\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2060': 'y\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20L\x2061': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U2\x20R2\x20U2\x20R\x27',
            'ZBLL\x20L\x2062': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20L\x2063': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20L\x2064': 'y\x20R2\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R2',
            'ZBLL\x20L\x2065': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20L\x2066': 'y2\x20R2\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R2',
            'ZBLL\x20L\x2067': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20L\x2068': 'R2\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x27\x20R2',
            'ZBLL\x20L\x2069': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20L\x2070': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20L\x2071': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20L\x2072': 'R\x20U\x27\x20R\x27\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x20L\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x201': 'R\x27\x20U2\x20R\x20U\x27\x20L\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20L\x27',
            'ZBLL\x20Pi\x202': 'R\x20U2\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L',
            'ZBLL\x20Pi\x203': 'y2\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x204': 'y2\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x205': 'R\x20U\x20R\x27\x20F\x27\x20U\x27\x20R\x20U2\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20F\x20R2\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x206': 'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20Pi\x207': 'R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x208': 'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20Pi\x209': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20F',
            'ZBLL\x20Pi\x2010': 'y\x27\x20F\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20F\x27',
            'ZBLL\x20Pi\x2011': 'y\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20Pi\x2012': 'R\x27\x20U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U2\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x2013': 'y\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2',
            'ZBLL\x20Pi\x2014': 'y\x27\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U\x27\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
            'ZBLL\x20Pi\x2015': 'R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x2016': 'R\x20U\x20R\x27\x20U\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2017': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'ZBLL\x20Pi\x2018': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R',
            'ZBLL\x20Pi\x2019': 'y\x27\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2020': 'y2\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20r\x27\x20F2\x20r\x20U2\x20R\x27\x20U\x27\x20r\x27\x20F\x20r',
            'ZBLL\x20Pi\x2021': 'y2\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2022': 'R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2023': 'R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x2024': 'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
            'ZBLL\x20Pi\x2025': 'R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x2026': 'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F',
            'ZBLL\x20Pi\x2027': 'y\x20L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2028': 'y2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R',
            'ZBLL\x20Pi\x2029': 'y\x20F\x20U\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R2\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2030': 'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2031': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20x\x20U\x27\x20L\x20U\x27\x20L\x27\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20x\x27',
            'ZBLL\x20Pi\x2032': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20F2\x20r\x20U2\x20r\x27\x20U\x27\x20r\x27\x20F\x20r',
            'ZBLL\x20Pi\x2033': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20B2\x20R\x27\x20U2\x20R\x20U2\x20l\x20U2\x20l\x27',
            'ZBLL\x20Pi\x2034': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2',
            'ZBLL\x20Pi\x2035': 'y\x20R2\x20F2\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F2\x20R2\x20U\x20R\x27\x20F2\x20R',
            'ZBLL\x20Pi\x2036': 'R\x27\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2037': 'R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x2038': 'R\x20U\x20R\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2039': 'L\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R\x20U\x20L\x27\x20U\x27\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2040': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x20R',
            'ZBLL\x20Pi\x2041': 'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20Pi\x2042': 'y2\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27\x20U\x20L\x27',
            'ZBLL\x20Pi\x2043': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R2\x20F2\x20U\x20R\x20U\x20R2\x20U\x27\x20R\x27\x20U\x27\x20F2\x20R2',
            'ZBLL\x20Pi\x2044': 'r\x27\x20F\x27\x20r\x20U\x20r\x20U2\x20r\x27\x20F2\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2045': 'l\x20U2\x20l\x27\x20U2\x20R\x27\x20U2\x20R\x20B2\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x2046': 'y2\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x2047': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
            'ZBLL\x20Pi\x2048': 'y\x27\x20R\x20U\x20R\x27\x20U\x20F2\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R',
            'ZBLL\x20Pi\x2049': 'R\x20U\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20Pi\x2050': 'y\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20F\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2051': 'y2\x20F\x20R2\x20U\x27\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x20R2\x20F\x27',
            'ZBLL\x20Pi\x2052': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2053': 'F\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R\x20U2\x20R\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20Pi\x2054': 'y\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'ZBLL\x20Pi\x2055': 'R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2056': 'R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x2057': 'y2\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2058': 'F\x20R2\x20U\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R2\x20F\x27',
            'ZBLL\x20Pi\x2059': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x2060': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20Pi\x2061': 'R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20Pi\x2062': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20Pi\x2063': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'ZBLL\x20Pi\x2064': 'y\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R',
            'ZBLL\x20Pi\x2065': 'y2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2066': 'y2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x2067': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20Pi\x2068': 'R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2069': 'R\x27\x20U\x27\x20R\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20Pi\x2070': 'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2071': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20Pi\x2072': 'R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x201': 'L\x27\x20U2\x20L\x20U2\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20L',
            'ZBLL\x20S\x202': 'y\x20R\x20U2\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x203': 'R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27',
            'ZBLL\x20S\x204': 'y2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U2\x20R\x27',
            'ZBLL\x20S\x205': 'L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U\x20R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'ZBLL\x20S\x206': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20B\x27\x20U\x20R2\x20U\x20R2\x20U\x27\x20B\x20U\x27\x20R\x27',
            'ZBLL\x20S\x207': 'y\x20R\x27\x20U\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20U\x27\x20R\x20F2\x20R\x27\x20U\x20F2\x20R2',
            'ZBLL\x20S\x208': 'y2\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U',
            'ZBLL\x20S\x209': 'y\x27\x20R\x27\x20U2\x20R\x27\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2010': 'y2\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
            'ZBLL\x20S\x2011': 'R\x20U\x20R2\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2012': 'R\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2013': 'y2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R',
            'ZBLL\x20S\x2014': 'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20l\x20U\x27\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20x',
            'ZBLL\x20S\x2015': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20U2\x20R',
            'ZBLL\x20S\x2016': 'y2\x20R\x20U2\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2017': 'y\x20R\x20U2\x20L\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2018': 'R\x27\x20D\x20R2\x20D\x27\x20R2\x20U\x20R2\x20D\x20R2\x20D\x27\x20R2\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2019': 'R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2020': 'y\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2021': 'y\x27\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2022': 'y\x20R\x20D\x27\x20R2\x20U\x27\x20F2\x20U\x27\x20F2\x20R\x20U2\x20R2\x20D\x20R2',
            'ZBLL\x20S\x2023': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
            'ZBLL\x20S\x2024': 'y2\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2025': 'R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2026': 'y\x27\x20R\x27\x20U2\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20U2\x20R',
            'ZBLL\x20S\x2027': 'R\x27\x20U2\x20R\x20L\x20U2\x20R\x27\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x20U2\x20L\x27',
            'ZBLL\x20S\x2028': 'L\x20U2\x20L\x20F\x20L\x27\x20U\x27\x20L\x27\x20U\x20L\x20F\x27\x20U2\x20L\x27',
            'ZBLL\x20S\x2029': 'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'ZBLL\x20S\x2030': 'D\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20D\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R2',
            'ZBLL\x20S\x2031': 'L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2032': 'y\x27\x20R2\x20U\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U\x20R\x20D\x27',
            'ZBLL\x20S\x2033': 'y\x20R\x27\x20U\x20R2\x20D\x20R2\x20U\x27\x20R2\x20U\x20R2\x20U\x20D\x27\x20R2\x20U2\x20R2\x20U\x20R',
            'ZBLL\x20S\x2034': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20S\x2035': 'R2\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'ZBLL\x20S\x2036': 'y\x27\x20R\x27\x20U\x27\x20D\x20R\x27\x20U\x20R\x20U2\x20D\x27\x20R2\x20U\x20R\x27\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2037': 'L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2038': 'y\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'ZBLL\x20S\x2039': 'y\x20R\x27\x20U2\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U2\x20R',
            'ZBLL\x20S\x2040': 'f\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20U2\x20S\x27',
            'ZBLL\x20S\x2041': 'y\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20L',
            'ZBLL\x20S\x2042': 'y\x20F\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20S\x2043': 'y2\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2044': 'R\x27\x20D\x20R\x27\x20U\x20R\x20D\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2045': 'y\x20L\x20U2\x20L\x27\x20U2\x20R\x27\x20U\x20L\x20U\x27\x20L\x27\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2046': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
            'ZBLL\x20S\x2047': 'R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2048': 'y2\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2049': 'y\x20R\x20U2\x20L\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2050': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L',
            'ZBLL\x20S\x2051': 'y\x27\x20R\x20U\x27\x20R2\x20U2\x20D\x27\x20R\x20U\x20R\x27\x20U\x20D\x20R2\x20U\x20R\x27',
            'ZBLL\x20S\x2052': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U2\x20R\x27\x20U2\x20R\x20U2\x20L\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20S\x2053': 'y\x27\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x20R\x27\x20U\x27\x20L\x27\x20U\x20L',
            'ZBLL\x20S\x2054': 'y2\x20L\x27\x20U2\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20L\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2055': 'y\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U2\x20R',
            'ZBLL\x20S\x2056': 'y\x27\x20R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20L\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2057': 'y2\x20R\x20U\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U2\x20R\x27',
            'ZBLL\x20S\x2058': 'F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20F\x27\x20R\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20S\x2059': 'R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2060': 'F\x20R\x20U\x27\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20S\x2061': 'y2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'ZBLL\x20S\x2062': 'y\x27\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R2',
            'ZBLL\x20S\x2063': 'R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R2\x20U2\x20R\x27',
            'ZBLL\x20S\x2064': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2065': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2066': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20S\x2067': 'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20S\x2068': 'R\x27\x20U2\x20R2\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20R',
            'ZBLL\x20S\x2069': 'R\x20U\x20R\x27\x20U\x20R2\x20U\x20R\x20U\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2',
            'ZBLL\x20S\x2070': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20S\x2071': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20S\x2072': 'R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20L\x20F2\x20L\x27\x20U2\x20R2\x20D\x20R2',
            'ZBLL\x20T\x201': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U\x27\x20L\x20R\x20U2\x20L\x27\x20U\x27\x20L',
            'ZBLL\x20T\x202': 'R2\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U2\x20R\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L',
            'ZBLL\x20T\x203': 'R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x204': 'y\x20R2\x20U\x20R2\x20U\x20R2\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R',
            'ZBLL\x20T\x205': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27',
            'ZBLL\x20T\x206': 'y\x20l\x27\x20U\x27\x20L\x20U\x20R\x20U\x27\x20r\x27\x20F',
            'ZBLL\x20T\x207': 'R\x27\x20U2\x20R\x20F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20F\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x208': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20L',
            'ZBLL\x20T\x209': 'y\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20T\x2010': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20F',
            'ZBLL\x20T\x2011': 'x\x27\x20M\x27\x20U\x27\x20R\x20U\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2012': 'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R',
            'ZBLL\x20T\x2013': 'y2\x20R2\x20B2\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x20B2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2014': 'R\x20D\x27\x20R\x27\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R\x27\x20D\x20R\x27',
            'ZBLL\x20T\x2015': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27\x20U\x20L\x27',
            'ZBLL\x20T\x2016': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20U2\x20R\x20U\x20R\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20T\x2017': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
            'ZBLL\x20T\x2018': 'y\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R',
            'ZBLL\x20T\x2019': 'y2\x20R\x20U2\x20R\x27\x20B\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20B\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2020': 'y\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20R\x20U\x20R\x27\x20L\x27',
            'ZBLL\x20T\x2021': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20T\x2022': 'y\x27\x20F\x27\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20F',
            'ZBLL\x20T\x2023': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2024': 'y2\x20R\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2025': 'R\x27\x20U\x20R\x20U2\x20L\x27\x20R\x27\x20U\x20R\x20U\x27\x20L',
            'ZBLL\x20T\x2026': 'y\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2027': 'y2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27\x20U\x20L\x27',
            'ZBLL\x20T\x2028': 'y\x27\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2029': 'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20T\x2030': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20T\x2031': 'y2\x20r\x20U\x27\x20r\x20U2\x20R\x27\x20F\x20R\x20U2\x20r2\x20F',
            'ZBLL\x20T\x2032': 'y2\x20R\x27\x20U\x27\x20R2\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2033': 'R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R2\x20U\x27\x20D\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2034': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20L',
            'ZBLL\x20T\x2035': 'F\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20F\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2036': 'y\x20L\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2037': 'y\x20R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2038': 'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x27\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20T\x2039': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20F\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2040': 'y2\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20T\x2041': 'y\x27\x20l\x27\x20U2\x20R\x27\x20D2\x20R\x20U2\x20R\x27\x20D2\x20R2\x20x\x27',
            'ZBLL\x20T\x2042': 'y\x27\x20l\x20U2\x20R\x20D2\x20R\x27\x20U2\x20R\x20D2\x20R2\x20x',
            'ZBLL\x20T\x2043': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
            'ZBLL\x20T\x2044': 'y2\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20L',
            'ZBLL\x20T\x2045': 'y\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20T\x2046': 'R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'ZBLL\x20T\x2047': 'L\x27\x20U\x27\x20L\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27\x20U\x20M\x27\x20x\x27',
            'ZBLL\x20T\x2048': 'y2\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'ZBLL\x20T\x2049': 'y\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2050': 'R\x27\x20U\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R2',
            'ZBLL\x20T\x2051': 'y\x20R\x20U\x27\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2052': 'R2\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2',
            'ZBLL\x20T\x2053': 'y2\x20r2\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
            'ZBLL\x20T\x2054': 'y2\x20R2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x27\x20U\x27\x20R2\x20U2\x20R\x20U2\x20R',
            'ZBLL\x20T\x2055': 'y2\x20R\x20U\x27\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2\x20U\x20R\x27',
            'ZBLL\x20T\x2056': 'R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U\x27\x20R',
            'ZBLL\x20T\x2057': 'y2\x20R2\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U\x20R2\x20U\x20R2',
            'ZBLL\x20T\x2058': 'y\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R2',
            'ZBLL\x20T\x2059': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2060': 'y2\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20T\x2061': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2062': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2063': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
            'ZBLL\x20T\x2064': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20T\x2065': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
            'ZBLL\x20T\x2066': 'y2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20T\x2067': 'y\x27\x20R\x27\x20U\x27\x20R2\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2068': 'y\x27\x20R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2069': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20T\x2070': 'y2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2071': 'R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20T\x2072': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x201': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
            'ZBLL\x20U\x202': 'y\x27\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20U\x203': 'y2\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'ZBLL\x20U\x204': 'y\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20U\x205': 'y\x27\x20R\x20U2\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27',
            'ZBLL\x20U\x206': 'y2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'ZBLL\x20U\x207': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20D\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20D\x27',
            'ZBLL\x20U\x208': 'R\x27\x20U\x27\x20R\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20U\x209': 'y\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20U\x2010': 'y\x20R\x27\x20U\x20R\x27\x20U\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R',
            'ZBLL\x20U\x2011': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U2\x20L\x27\x20U2\x20R\x20U\x27\x20L\x20U2\x20L\x27',
            'ZBLL\x20U\x2012': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x20R\x27',
            'ZBLL\x20U\x2013': 'R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R\x20U2\x20R',
            'ZBLL\x20U\x2014': 'y\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x2015': 'y2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27',
            'ZBLL\x20U\x2016': 'y\x27\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20U\x2017': 'R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
            'ZBLL\x20U\x2018': 'y\x27\x20R\x27\x20U2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x2019': 'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20D',
            'ZBLL\x20U\x2020': 'R\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x27',
            'ZBLL\x20U\x2021': 'R\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U2\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2',
            'ZBLL\x20U\x2022': 'y\x27\x20L\x20U\x20R\x27\x20U\x20L\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'ZBLL\x20U\x2023': 'y\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x27\x20R',
            'ZBLL\x20U\x2024': 'y\x27\x20R\x20U\x20R\x27\x20U2\x20F2\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R2\x20U\x20R\x27',
            'ZBLL\x20U\x2025': 'R\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R',
            'ZBLL\x20U\x2026': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'ZBLL\x20U\x2027': 'y\x27\x20F2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F2',
            'ZBLL\x20U\x2028': 'y\x20R\x20U\x27\x20L\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20l\x20U2\x20R\x20U2\x20R2\x20x',
            'ZBLL\x20U\x2029': 'y\x27\x20F\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20F\x27\x20R\x27\x20U\x20R',
            'ZBLL\x20U\x2030': 'y\x27\x20R\x27\x20U\x27\x20R\x20F\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20F\x27',
            'ZBLL\x20U\x2031': 'y\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x2032': 'y\x27\x20R2\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20U\x2033': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
            'ZBLL\x20U\x2034': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
            'ZBLL\x20U\x2035': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20U\x2036': 'y\x27\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20U\x2037': 'y2\x20R\x20U\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20U\x2038': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
            'ZBLL\x20U\x2039': 'R\x27\x20U\x27\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20U\x2040': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
            'ZBLL\x20U\x2041': 'x\x27\x20R2\x20D2\x20R\x27\x20U2\x20R\x20D2\x20R\x27\x20U2\x20R\x27\x20x',
            'ZBLL\x20U\x2042': 'y2\x20x\x20R2\x20D2\x20R\x20U2\x20R\x27\x20D2\x20R\x20U2\x20R\x20x\x27',
            'ZBLL\x20U\x2043': 'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
            'ZBLL\x20U\x2044': 'y2\x20R\x20U\x27\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x27\x20F\x27\x20U\x20F',
            'ZBLL\x20U\x2045': 'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x27\x20R',
            'ZBLL\x20U\x2046': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x20R\x27',
            'ZBLL\x20U\x2047': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R',
            'ZBLL\x20U\x2048': 'R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20F\x27\x20R\x27',
            'ZBLL\x20U\x2049': 'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2',
            'ZBLL\x20U\x2050': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20F\x20U\x20R',
            'ZBLL\x20U\x2051': 'R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L',
            'ZBLL\x20U\x2052': 'R\x27\x20U2\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
            'ZBLL\x20U\x2053': 'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20U\x2054': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20M\x20U\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
            'ZBLL\x20U\x2055': 'y\x27\x20R\x20U2\x20R2\x20F\x20R\x20F\x27\x20M\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20M',
            'ZBLL\x20U\x2056': 'y\x20R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20L\x20U\x20L\x27\x20U\x20L',
            'ZBLL\x20U\x2057': 'L\x20U2\x20L\x27\x20F\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20F',
            'ZBLL\x20U\x2058': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x27\x20F\x20R2\x20B\x27\x20R2\x20F\x27\x20R2\x20B\x20R\x27',
            'ZBLL\x20U\x2059': 'L\x20U2\x20R\x27\x20U\x20R\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x2060': 'y2\x20R\x20U\x20R\x27\x20U\x20L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20U\x2061': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20U\x2062': 'y\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'ZBLL\x20U\x2063': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20U\x2064': 'y\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
            'ZBLL\x20U\x2065': 'y\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x2066': 'y\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
            'ZBLL\x20U\x2067': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R2\x20U\x27\x20R\x27',
            'ZBLL\x20U\x2068': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20R',
            'ZBLL\x20U\x2069': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
            'ZBLL\x20U\x2070': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
            'ZBLL\x20U\x2071': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U2\x20R2\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2',
            'ZBLL\x20U\x2072': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R'
        };
        let _0x56b3dd = [];
        let _0x8f9ba0 = Object['keys'](_0x1d9ba2);
        for (let _0x4bab6c = 0x0; _0x4bab6c < _0x8f9ba0['length']; _0x4bab6c++) {
            let _0x26b114 = _0x1d9ba2[_0x8f9ba0[_0x4bab6c]];
            for (let _0xf2b1a = 0x0; _0xf2b1a < 0x4; _0xf2b1a++) {
                let _0x2a9fe8 = new_NxN_Data(0x3);
                for (let _0x14ed01 = 0x0; _0x14ed01 < _0xf2b1a; _0x14ed01++)
                    ProcessMoves(_0x2a9fe8, 'y');
                let _0x1deb19 = NxN_AlgHandler['InvertMoves'](_0x26b114);
                ProcessMoves(_0x2a9fe8, _0x1deb19);
                for (let _0x185c1f = 0x0; _0x185c1f < 0x4; _0x185c1f++) {
                    let _0x125419 = _0x8f9ba0[_0x4bab6c];
                    let _0x4a06cb = getZBLLHash(_0x2a9fe8);
                    if (!_0x56b3dd['hasOwnProperty'](_0x4a06cb)) {
                        _0x56b3dd[_0x4a06cb] = [];
                    }
                    _0x56b3dd[_0x4a06cb]['push']([
                        _0x125419,
                        _0x185c1f
                    ]);
                    ProcessMoves(_0x2a9fe8, 'U');
                }
            }
        }
        let _0x338d55 = Object['keys'](_0x56b3dd);
        let _0x5cf6a3 = '{';
        for (let _0x38cb27 = 0x0; _0x38cb27 < _0x338d55['length']; _0x38cb27++) {
            _0x5cf6a3 += '\x22' + _0x338d55[_0x38cb27] + '\x22:{\x22name\x22:\x22' + _0x56b3dd[_0x338d55[_0x38cb27]][0x0][0x0] + '\x22,\x20\x22orientation\x22:\x20' + _0x56b3dd[_0x338d55[_0x38cb27]][0x0][0x1] + '},';
        }
        _0x5cf6a3 += '}';
        console['log'](_0x56b3dd);
        console['log'](_0x5cf6a3);
    }
    static ['getHash'](_0x236c5c) {
        let _0x2dbaa1 = [];
        for (const _0x50a481 of 'UDLRFB') {
            let _0xd6c78 = 0x0;
            for (let _0x2e8377 = 0x0; _0x2e8377 < _0x236c5c['rank']; _0x2e8377++) {
                for (let _0x37ac2c = 0x0; _0x37ac2c < _0x236c5c['rank']; _0x37ac2c++) {
                    _0xd6c78 <<= 0x3;
                    switch (_0x236c5c['mat'][_0x50a481][_0x2e8377][_0x37ac2c]) {
                    case 'U':
                        _0xd6c78 += 0x1;
                        break;
                    case 'D':
                        _0xd6c78 += 0x2;
                        break;
                    case 'L':
                        _0xd6c78 += 0x3;
                        break;
                    case 'R':
                        _0xd6c78 += 0x4;
                        break;
                    case 'F':
                        _0xd6c78 += 0x5;
                        break;
                    case 'B':
                        _0xd6c78 += 0x6;
                        break;
                    case 'M':
                        _0xd6c78 += 0x7;
                    }
                }
            }
            _0x2dbaa1[_0x50a481] = _0xd6c78;
        }
        return _0x2dbaa1;
    }
    static ['getKHash'](_0x351334) {
        let _0x2ce8d3 = '';
        for (const _0x59d210 of 'URFDLB') {
            for (let _0x20e3ed = 0x0; _0x20e3ed < _0x351334['rank']; _0x20e3ed++) {
                for (let _0x79cc82 = 0x0; _0x79cc82 < _0x351334['rank']; _0x79cc82++) {
                    _0x2ce8d3 += _0x351334['mat'][_0x59d210][_0x20e3ed][_0x79cc82];
                }
            }
        }
        return _0x2ce8d3;
    }
    static ['getUFRHash'](_0x4f7b00) {
        let _0x80bef = '';
        for (const _0x4da5c7 of 'UFR') {
            for (let _0x2a9e1e = 0x0; _0x2a9e1e < _0x4f7b00['rank']; _0x2a9e1e++) {
                for (let _0x45ae46 = 0x0; _0x45ae46 < _0x4f7b00['rank']; _0x45ae46++) {
                    _0x80bef += _0x4f7b00['mat'][_0x4da5c7][_0x2a9e1e][_0x45ae46];
                }
            }
        }
        return _0x80bef;
    }
    static ['printHash'](_0x354b1f) {
        let _0x476c0e = '{';
        for (const _0x33737e of 'BDFLRU') {
            _0x476c0e += '\x22' + _0x33737e + '\x22:';
            let _0x3e75a7 = _0x354b1f[_0x33737e];
            _0x476c0e += _0x3e75a7 + ',\x20';
        }
        _0x476c0e += '}';
        console['log'](_0x476c0e);
    }
    static ['getNormalizedHash'](_0x2cbf89) {
        let _0x12ae92 = Math['floor'](_0x2cbf89['rank'] / 0x2);
        let _0x413a78 = [];
        let _0xe3d80b = [];
        let _0x83b96 = {
            'U': 'D',
            'D': 'U',
            'L': 'R',
            'R': 'L',
            'F': 'B',
            'B': 'F'
        };
        let _0x1cb0d5 = {
            'LD': 'F',
            'UL': 'F',
            'RU': 'F',
            'DR': 'F',
            'RD': 'B',
            'UR': 'B',
            'LU': 'B',
            'DL': 'B',
            'FD': 'R',
            'DB': 'R',
            'BU': 'R',
            'UF': 'R',
            'BD': 'L',
            'DF': 'L',
            'FU': 'L',
            'UB': 'L',
            'LF': 'U',
            'FR': 'U',
            'RB': 'U',
            'BL': 'U',
            'LB': 'D',
            'BR': 'D',
            'RF': 'D',
            'FL': 'D'
        };
        let _0x5a0fe3 = _0x2cbf89['mat']['L'][0x2][_0x12ae92];
        let _0x170aea = _0x2cbf89['mat']['D'][_0x12ae92][0x0];
        _0xe3d80b = {};
        _0xe3d80b[_0x83b96[_0x170aea]] = 'U';
        _0xe3d80b[_0x170aea] = 'D';
        _0xe3d80b[_0x5a0fe3] = 'L';
        _0xe3d80b[_0x83b96[_0x5a0fe3]] = 'R';
        _0xe3d80b[_0x1cb0d5[_0x5a0fe3 + _0x170aea]] = 'F';
        _0xe3d80b[_0x83b96[_0x1cb0d5[_0x5a0fe3 + _0x170aea]]] = 'B';
        for (const _0x549ab1 of 'UDLRFB') {
            let _0x35b2c6 = 0x0;
            for (let _0x211736 = 0x0; _0x211736 < _0x2cbf89['rank']; _0x211736++) {
                for (let _0x530ba5 = 0x0; _0x530ba5 < _0x2cbf89['rank']; _0x530ba5++) {
                    _0x35b2c6 <<= 0x3;
                    switch (_0xe3d80b[_0x2cbf89['mat'][_0x549ab1][_0x211736][_0x530ba5]]) {
                    case 'U':
                        _0x35b2c6 += 0x1;
                        break;
                    case 'D':
                        _0x35b2c6 += 0x2;
                        break;
                    case 'L':
                        _0x35b2c6 += 0x3;
                        break;
                    case 'R':
                        _0x35b2c6 += 0x4;
                        break;
                    case 'F':
                        _0x35b2c6 += 0x5;
                        break;
                    case 'B':
                        _0x35b2c6 += 0x6;
                        break;
                    }
                }
            }
            _0x413a78[_0x549ab1] = _0x35b2c6;
        }
        return _0x413a78;
    }
    static ['getNormalizedPuzzle'](_0xab0a95) {
        let _0x366ed3 = Math['floor'](_0xab0a95['rank'] / 0x2);
        let _0x435db4 = [];
        let _0x233bec = [];
        let _0x52563c = {
            'U': 'D',
            'D': 'U',
            'L': 'R',
            'R': 'L',
            'F': 'B',
            'B': 'F'
        };
        let _0x349c4b = {
            'LD': 'F',
            'UL': 'F',
            'RU': 'F',
            'DR': 'F',
            'RD': 'B',
            'UR': 'B',
            'LU': 'B',
            'DL': 'B',
            'FD': 'R',
            'DB': 'R',
            'BU': 'R',
            'UF': 'R',
            'BD': 'L',
            'DF': 'L',
            'FU': 'L',
            'UB': 'L',
            'LF': 'U',
            'FR': 'U',
            'RB': 'U',
            'BL': 'U',
            'LB': 'D',
            'BR': 'D',
            'RF': 'D',
            'FL': 'D'
        };
        let _0x80fcf9 = _0xab0a95['mat']['L'][0x2][_0x366ed3];
        let _0x240457 = _0xab0a95['mat']['D'][_0x366ed3][0x0];
        _0x233bec = {};
        _0x233bec[_0x52563c[_0x240457]] = 'U';
        _0x233bec[_0x240457] = 'D';
        _0x233bec[_0x80fcf9] = 'L';
        _0x233bec[_0x52563c[_0x80fcf9]] = 'R';
        _0x233bec[_0x349c4b[_0x80fcf9 + _0x240457]] = 'F';
        _0x233bec[_0x52563c[_0x349c4b[_0x80fcf9 + _0x240457]]] = 'B';
        let _0x26eb8d = NxN['new_NxN_Data'](_0xab0a95['rank']);
        for (const _0xaeda45 of NxN['faces']) {
            for (let _0x2d5efb = 0x0; _0x2d5efb < _0xab0a95['rank']; _0x2d5efb++) {
                for (let _0x1883d7 = 0x0; _0x1883d7 < _0xab0a95['rank']; _0x1883d7++) {
                    _0x26eb8d['mat'][_0xaeda45][_0x2d5efb][_0x1883d7] = _0x233bec[_0xab0a95['mat'][_0xaeda45][_0x2d5efb][_0x1883d7]];
                }
            }
        }
        return _0x26eb8d;
    }
    static ['getMaskedHash'](_0x5b85d2, _0x193450) {
        let _0x4544a = getNormalizedHash(_0x5b85d2);
        let _0x26d440 = {};
        for (const _0x1a50fb of 'UDLRFB') {
            _0x26d440[_0x1a50fb] = hash[_0x1a50fb] & _0x193450[_0x1a50fb];
        }
        return _0x26d440;
    }
    static ['getOLLHash'](_0x593936) {
        let _0x1af614 = _0x593936['mat']['U'][0x1][0x1];
        let _0xf2f102 = 0x0;
        for (let _0xd2ef62 = 0x0; _0xd2ef62 < 0x3; _0xd2ef62++) {
            for (let _0x49a8df = 0x0; _0x49a8df < 0x3; _0x49a8df++) {
                if (_0x593936['mat']['U'][_0xd2ef62][_0x49a8df] == _0x1af614) {
                    _0xf2f102 += 0x1 << (0x3 - 0x1 - _0xd2ef62) * 0x3 + (0x3 - 0x1 - _0x49a8df) + 0xc;
                }
            }
            if (_0x593936['mat']['F'][0x0][_0xd2ef62] == _0x1af614)
                _0xf2f102 += 0x1 << 0x3 - 0x1 - _0xd2ef62;
            if (_0x593936['mat']['L'][0x0][_0xd2ef62] == _0x1af614)
                _0xf2f102 += 0x1 << 0x3 - 0x1 - _0xd2ef62 + 0x3;
            if (_0x593936['mat']['B'][0x0][_0xd2ef62] == _0x1af614)
                _0xf2f102 += 0x1 << 0x3 - 0x1 - _0xd2ef62 + 0x6;
            if (_0x593936['mat']['R'][0x0][_0xd2ef62] == _0x1af614)
                _0xf2f102 += 0x1 << 0x3 - 0x1 - _0xd2ef62 + 0x9;
        }
        return _0xf2f102;
    }
    static ['getNewPLLHash'](_0x575d54) {
        return [
            ..._0x575d54['mat']['F'][0x0],
            ..._0x575d54['mat']['R'][0x0]
        ]['join']('');
    }
    static ['getCMLLHash']() {
        return [
            data['mat']['U'][0x0][0x0],
            data['mat']['U'][0x0][0x2],
            data['mat']['U'][0x2][0x0],
            data['mat']['U'][0x2][0x2],
            data['mat']['F'][0x0][0x0],
            data['mat']['F'][0x0][0x2],
            data['mat']['R'][0x0][0x0],
            data['mat']['R'][0x0][0x2]
        ]['join']('');
    }
    static ['getCOLLHash']() {
        return [
            ...data['mat']['U'][0x0],
            ...data['mat']['U'][0x1],
            ...data['mat']['U'][0x2],
            data['mat']['F'][0x0][0x0],
            data['mat']['F'][0x0][0x2],
            data['mat']['R'][0x0][0x0],
            data['mat']['R'][0x0][0x2],
            data['mat']['B'][0x0][0x0],
            data['mat']['B'][0x0][0x2],
            data['mat']['L'][0x0][0x0],
            data['mat']['L'][0x0][0x2]
        ]['join']('');
    }
    static ['getZBLLHash']() {
        return [
            ...data['mat']['U'][0x0],
            ...data['mat']['U'][0x1],
            ...data['mat']['U'][0x2],
            ...data['mat']['F'][0x0],
            ...data['mat']['R'][0x0],
            ...data['mat']['B'][0x0],
            ...data['mat']['L'][0x0]
        ]['join']('');
    }
    static ['compareHash'](_0x563aac, _0x5502e9, _0x2ddca0) {
        for (const _0x5412e0 of 'UDLRFB') {
            if ((_0x2ddca0[_0x5412e0] & _0x5502e9[_0x5412e0]) != _0x563aac[_0x5412e0]) {
                return ![];
            }
        }
        return !![];
    }
    static ['rotateFaceCounterClockwise'](_0x1e3fce, _0x27bd17, _0x26d4dd) {
        switch (_0x26d4dd % 0x4) {
        case 0x1: {
                let _0x3925bc = [];
                for (let _0x37cb6d = 0x0; _0x37cb6d < _0x1e3fce['rank']; _0x37cb6d++) {
                    _0x3925bc[_0x37cb6d] = [];
                    for (let _0x547e62 = 0x0; _0x547e62 < _0x1e3fce['rank']; _0x547e62++) {
                        _0x3925bc[_0x37cb6d]['push']('\x20');
                    }
                }
                let _0x6990b4 = 0x0;
                for (let _0x1fe8c8 = _0x1e3fce['rank'] - 0x1; _0x1fe8c8 >= 0x0; _0x1fe8c8--) {
                    let _0x2da841 = 0x0;
                    for (let _0x43e8ce = 0x0; _0x43e8ce < _0x1e3fce['rank']; _0x43e8ce++) {
                        _0x3925bc[_0x6990b4][_0x2da841] = _0x1e3fce['mat'][_0x27bd17][_0x43e8ce][_0x1fe8c8];
                        _0x2da841++;
                    }
                    _0x6990b4++;
                }
                _0x1e3fce['mat'][_0x27bd17] = _0x3925bc;
            }
            break;
        case 0x2:
            for (let _0x544550 = 0x0; _0x544550 < 0x2; _0x544550++) {
                let _0x263d7b = [];
                for (let _0x1c3961 = 0x0; _0x1c3961 < _0x1e3fce['rank']; _0x1c3961++) {
                    _0x263d7b[_0x1c3961] = [];
                    for (let _0x43c090 = 0x0; _0x43c090 < _0x1e3fce['rank']; _0x43c090++) {
                        _0x263d7b[_0x1c3961]['push']('\x20');
                    }
                }
                let _0xd101df = 0x0;
                for (let _0x102b83 = _0x1e3fce['rank'] - 0x1; _0x102b83 >= 0x0; _0x102b83--) {
                    let _0x13577e = 0x0;
                    for (let _0x35cc37 = 0x0; _0x35cc37 < _0x1e3fce['rank']; _0x35cc37++) {
                        _0x263d7b[_0xd101df][_0x13577e] = _0x1e3fce['mat'][_0x27bd17][_0x35cc37][_0x102b83];
                        _0x13577e++;
                    }
                    _0xd101df++;
                }
                _0x1e3fce['mat'][_0x27bd17] = _0x263d7b;
            }
            break;
        case 0x3: {
                let _0xc0c553 = [];
                for (let _0x5e2ab5 = 0x0; _0x5e2ab5 < _0x1e3fce['rank']; _0x5e2ab5++) {
                    _0xc0c553[_0x5e2ab5] = [];
                    for (let _0x1e0392 = 0x0; _0x1e0392 < _0x1e3fce['rank']; _0x1e0392++) {
                        _0xc0c553[_0x5e2ab5]['push']('\x20');
                    }
                }
                let _0x2a3e05 = 0x0;
                for (let _0x3a84b2 = 0x0; _0x3a84b2 < _0x1e3fce['rank']; _0x3a84b2++) {
                    let _0x325857 = 0x0;
                    for (let _0x4e8011 = _0x1e3fce['rank'] - 0x1; _0x4e8011 >= 0x0; _0x4e8011--) {
                        _0xc0c553[_0x2a3e05][_0x325857] = _0x1e3fce['mat'][_0x27bd17][_0x4e8011][_0x3a84b2];
                        _0x325857++;
                    }
                    _0x2a3e05++;
                }
                _0x1e3fce['mat'][_0x27bd17] = _0xc0c553;
            }
            break;
        }
    }
    static ['rotateFaceClockwise'](_0x5d9317, _0x16356b, _0x3c0910) {
        _0x3c0910 = _0x3c0910 % 0x4;
        _0x3c0910 = 0x4 - _0x3c0910;
        if (_0x3c0910 < 0x0) {
            _0x3c0910 = 0x4 - _0x3c0910;
        }
        this['rotateFaceCounterClockwise'](_0x5d9317, _0x16356b, _0x3c0910);
    }
    static ['exchangeRow'](_0x10071a, _0x412756, _0x1a9026, _0x2d6f9b) {
        for (let _0x5c7ac5 = 0x0; _0x5c7ac5 < _0x10071a['rank']; _0x5c7ac5++) {
            let _0x9d8f98 = _0x10071a['mat'][_0x412756][_0x2d6f9b][_0x5c7ac5];
            _0x10071a['mat'][_0x412756][_0x2d6f9b][_0x5c7ac5] = _0x10071a['mat'][_0x1a9026][_0x2d6f9b][_0x5c7ac5];
            _0x10071a['mat'][_0x1a9026][_0x2d6f9b][_0x5c7ac5] = _0x9d8f98;
        }
    }
    static ['exchangeCol'](_0x872a5f, _0x2b74ae, _0x5a2073, _0x5e1a6c) {
        for (let _0x49d2f9 = 0x0; _0x49d2f9 < _0x872a5f['rank']; _0x49d2f9++) {
            let _0x365300 = _0x872a5f['mat'][_0x2b74ae][_0x49d2f9][_0x5e1a6c];
            _0x872a5f['mat'][_0x2b74ae][_0x49d2f9][_0x5e1a6c] = _0x872a5f['mat'][_0x5a2073][_0x49d2f9][_0x5e1a6c];
            _0x872a5f['mat'][_0x5a2073][_0x49d2f9][_0x5e1a6c] = _0x365300;
        }
    }
    static ['performRawMove'](_0x3ab7ff, _0x5dcd0f, _0x25cbd7, _0x191a8a, _0x26d350) {
        const _0x436119 = {
            'U': 'BLFR',
            'D': 'FLBR',
            'L': 'UBDF',
            'R': 'UFDB',
            'F': 'ULDR',
            'B': 'URDL'
        };
        const _0xab8365 = {
            'U': 'D',
            'D': 'U',
            'L': 'R',
            'R': 'L',
            'F': 'B',
            'B': 'R'
        };
        if (_0x191a8a == ![]) {
            _0x26d350 = 0x4 - _0x26d350;
        }
        if (_0x26d350 < 0x0) {
            _0x26d350 = 0x4 - _0x26d350;
        }
        _0x26d350 = _0x26d350 % 0x4;
        for (let _0x15fb80 = 0x0; _0x15fb80 < _0x26d350; _0x15fb80++) {
            if (_0x25cbd7 == 0x0) {
                this['rotateFaceClockwise'](_0x3ab7ff, _0x5dcd0f, 0x1);
            } else if (_0x25cbd7 == _0x3ab7ff['rank'] - 0x1) {
                this['performRawMove'](_0x3ab7ff, _0xab8365[_0x5dcd0f], 0x0, ![], 0x1);
                continue;
            }
            let _0xa38384 = _0x436119[_0x5dcd0f];
            for (let _0x5f3662 = 0x0; _0x5f3662 < 0x3; _0x5f3662++) {
                switch (_0x5dcd0f) {
                case 'U':
                    this['exchangeRow'](_0x3ab7ff, _0xa38384[_0x5f3662], _0xa38384[_0x5f3662 + 0x1], _0x25cbd7);
                    break;
                case 'D':
                    this['exchangeRow'](_0x3ab7ff, _0xa38384[_0x5f3662], _0xa38384[_0x5f3662 + 0x1], _0x3ab7ff['rank'] - 0x1 - _0x25cbd7);
                    break;
                case 'L':
                    this['rotateFaceClockwise'](_0x3ab7ff, 'B', 0x2);
                    this['exchangeCol'](_0x3ab7ff, _0xa38384[_0x5f3662], _0xa38384[_0x5f3662 + 0x1], _0x25cbd7);
                    this['rotateFaceClockwise'](_0x3ab7ff, 'B', 0x2);
                    break;
                case 'R':
                    this['rotateFaceClockwise'](_0x3ab7ff, 'B', 0x2);
                    this['exchangeCol'](_0x3ab7ff, _0xa38384[_0x5f3662], _0xa38384[_0x5f3662 + 0x1], _0x3ab7ff['rank'] - 0x1 - _0x25cbd7);
                    this['rotateFaceClockwise'](_0x3ab7ff, 'B', 0x2);
                    break;
                case 'F':
                    this['rotateFaceClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662], _0x5f3662);
                    this['rotateFaceClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662 + 0x1], _0x5f3662 + 0x1);
                    this['exchangeRow'](_0x3ab7ff, _0xa38384[_0x5f3662], _0xa38384[_0x5f3662 + 0x1], _0x3ab7ff['rank'] - 0x1 - _0x25cbd7);
                    this['rotateFaceCounterClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662], _0x5f3662);
                    this['rotateFaceCounterClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662 + 0x1], _0x5f3662 + 0x1);
                    break;
                case 'B':
                    this['rotateFaceCounterClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662], _0x5f3662);
                    this['rotateFaceCounterClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662 + 0x1], _0x5f3662 + 0x1);
                    this['exchangeRow'](_0x3ab7ff, _0xa38384[_0x5f3662], _0xa38384[_0x5f3662 + 0x1], _0x25cbd7);
                    this['rotateFaceClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662], _0x5f3662);
                    this['rotateFaceClockwise'](_0x3ab7ff, _0xa38384[_0x5f3662 + 0x1], _0x5f3662 + 0x1);
                    break;
                }
            }
        }
    }
    static ['PerformFormalMove'](_0x56d262, _0x1247c9) {
        if (_0x1247c9 == '\x0aor' || _0x1247c9 == '\x0aOR')
            return;
        let _0x479890 = !![];
        let _0x4f50d8 = 0x1;
        let _0x5b5820 = '';
        let _0x3ce9ca = 0x0;
        let _0xc0d09a = '';
        let _0x5b6960 = '';
        let _0x488ba9 = 0x1;
        let _0x71b524 = ![];
        let _0x3d6b1a = 0x0;
        let _0x258e58 = 0x0;
        for (let _0x59593c of NxN['legalmoves']) {
            if (_0x1247c9 == _0x59593c) {
                _0xc0d09a = _0x59593c;
                break;
            }
            if (_0x1247c9[0x0] != _0x59593c[0x0])
                continue;
            for (let _0x5b213e of NxN['legalsuffix']) {
                if (_0x1247c9 == _0x59593c + _0x5b213e) {
                    _0xc0d09a = _0x59593c;
                    _0x5b6960 = _0x5b213e;
                    break;
                }
            }
            if (_0xc0d09a != '')
                break;
        }
        switch (_0x5b6960) {
        case '\x27':
        case '3':
            _0x4f50d8 = 0x1;
            _0x479890 = ![];
            break;
        case '2':
        case '2\x27':
            _0x4f50d8 = 0x2;
            break;
        case '3\x27':
            _0x4f50d8 = 0x1;
            break;
        }
        switch (_0xc0d09a) {
        case 'L':
            _0x5b5820 = 'L';
            break;
        case 'R':
            _0x5b5820 = 'R';
            break;
        case 'F':
            _0x5b5820 = 'F';
            break;
        case 'B':
            _0x5b5820 = 'B';
            break;
        case 'D':
            _0x5b5820 = 'D';
            break;
        case 'U':
            _0x5b5820 = 'U';
            break;
        case '2L':
            _0x5b5820 = 'L';
            _0x3ce9ca = 0x1;
            break;
        case '3L':
            _0x5b5820 = 'L';
            _0x3ce9ca = 0x2;
            break;
        case '4L':
            _0x5b5820 = 'L';
            _0x3ce9ca = 0x3;
            break;
        case '5L':
            _0x5b5820 = 'L';
            _0x3ce9ca = 0x4;
            break;
        case '2F':
            _0x5b5820 = 'F';
            _0x3ce9ca = 0x1;
            break;
        case '3F':
            _0x5b5820 = 'F';
            _0x3ce9ca = 0x2;
            break;
        case '4F':
            _0x5b5820 = 'F';
            _0x3ce9ca = 0x3;
            break;
        case '5F':
            _0x5b5820 = 'F';
            _0x3ce9ca = 0x4;
            break;
        case '6F':
            _0x5b5820 = 'F';
            _0x3ce9ca = 0x5;
            break;
        case '2B':
            _0x5b5820 = 'B';
            _0x3ce9ca = 0x1;
            break;
        case '3B':
            _0x5b5820 = 'B';
            _0x3ce9ca = 0x2;
            break;
        case '4B':
            _0x5b5820 = 'B';
            _0x3ce9ca = 0x3;
            break;
        case '5B':
            _0x5b5820 = 'B';
            _0x3ce9ca = 0x4;
            break;
        case '2R':
            _0x5b5820 = 'R';
            _0x3ce9ca = 0x1;
            break;
        case '3R':
            _0x5b5820 = 'R';
            _0x3ce9ca = 0x2;
            break;
        case '4R':
            _0x5b5820 = 'R';
            _0x3ce9ca = 0x3;
            break;
        case '5R':
            _0x5b5820 = 'R';
            _0x3ce9ca = 0x4;
            break;
        case '2U':
            _0x5b5820 = 'U';
            _0x3ce9ca = 0x1;
            break;
        case '3U':
            _0x5b5820 = 'U';
            _0x3ce9ca = 0x2;
            break;
        case '4U':
            _0x5b5820 = 'U';
            _0x3ce9ca = 0x3;
            break;
        case '5U':
            _0x5b5820 = 'U';
            _0x3ce9ca = 0x4;
            break;
        case '2D':
            _0x5b5820 = 'D';
            _0x3ce9ca = 0x1;
            break;
        case '3D':
            _0x5b5820 = 'D';
            _0x3ce9ca = 0x3;
            break;
        case '4D':
            _0x5b5820 = 'D';
            _0x3ce9ca = 0x4;
            break;
        case '5D':
            _0x5b5820 = 'D';
            _0x3ce9ca = 0x5;
            break;
        case '2l':
        case 'Lw':
        case 'l':
            _0x5b5820 = 'L';
            _0x488ba9 = 0x2;
            break;
        case '3Lw':
        case '3l':
            _0x5b5820 = 'L';
            _0x488ba9 = 0x3;
            break;
        case '4l':
        case '4Lw':
            _0x5b5820 = 'L';
            _0x488ba9 = 0x4;
            break;
        case '5l':
        case '5Lw':
            _0x5b5820 = 'L';
            _0x488ba9 = 0x5;
            break;
        case '6l':
        case '6Lw':
            _0x5b5820 = 'L';
            _0x488ba9 = 0x6;
            break;
        case '2r':
        case 'Rw':
        case 'r':
            _0x5b5820 = 'R';
            _0x488ba9 = 0x2;
            break;
        case '3r':
        case '3Rw':
            _0x5b5820 = 'R';
            _0x488ba9 = 0x3;
            break;
        case '4r':
        case '4Rw':
            _0x5b5820 = 'R';
            _0x488ba9 = 0x4;
            break;
        case '5r':
        case '5Rw':
            _0x5b5820 = 'R';
            _0x488ba9 = 0x5;
            break;
        case '6r':
        case '6Rw':
            _0x5b5820 = 'R';
            _0x488ba9 = 0x6;
            break;
        case '2f':
        case 'Fw':
        case 'f':
            _0x5b5820 = 'F';
            _0x488ba9 = 0x2;
            break;
        case '3f':
        case '3Fw':
            _0x5b5820 = 'F';
            _0x488ba9 = 0x3;
            break;
        case '4f':
        case '4Fw':
            _0x5b5820 = 'F';
            _0x488ba9 = 0x4;
            break;
        case '5f':
        case '5Fw':
            _0x5b5820 = 'F';
            _0x488ba9 = 0x5;
            break;
        case '6f':
        case '6Fw':
            _0x5b5820 = 'F';
            _0x488ba9 = 0x6;
            break;
        case '2b':
        case 'Bw':
        case 'b':
            _0x5b5820 = 'B';
            _0x488ba9 = 0x2;
            break;
        case '3b':
        case '3Bw':
            _0x5b5820 = 'B';
            _0x488ba9 = 0x3;
            break;
        case '4b':
        case '4Bw':
            _0x5b5820 = 'B';
            _0x488ba9 = 0x4;
            break;
        case '5b':
        case '5Bw':
            _0x5b5820 = 'B';
            _0x488ba9 = 0x5;
            break;
        case '6b':
        case '6Bw':
            _0x5b5820 = 'B';
            _0x488ba9 = 0x6;
            break;
        case '2Dw':
        case 'Dw':
        case 'd':
        case '2d':
            _0x5b5820 = 'D';
            _0x488ba9 = 0x2;
            break;
        case '3d':
        case '3Dw':
            _0x5b5820 = 'D';
            _0x488ba9 = 0x3;
            break;
        case '4d':
        case '4Dw':
            _0x5b5820 = 'D';
            _0x488ba9 = 0x4;
            break;
        case '5d':
        case '5Dw':
            _0x5b5820 = 'D';
            _0x488ba9 = 0x5;
            break;
        case '6d':
        case '6Dw':
            _0x5b5820 = 'D';
            _0x488ba9 = 0x6;
            break;
        case 'Uw':
        case '2u':
        case 'u':
            _0x5b5820 = 'U';
            _0x488ba9 = 0x2;
            break;
        case '3u':
        case '3Uw':
            _0x5b5820 = 'U';
            _0x488ba9 = 0x3;
            break;
        case '4u':
        case '4Uw':
            _0x5b5820 = 'U';
            _0x488ba9 = 0x4;
            break;
        case '5u':
        case '5Uw':
            _0x5b5820 = 'U';
            _0x488ba9 = 0x5;
            break;
        case '6u':
        case '6Uw':
            _0x5b5820 = 'U';
            _0x488ba9 = 0x6;
            break;
        case 'M':
            _0x5b5820 = 'L';
            _0x3ce9ca = 0x1;
            _0x488ba9 = _0x56d262['rank'] - 0x2;
            if (_0x56d262['rank'] == 0x4) {
                _0x5b5820 = 'L';
                _0x3ce9ca = 0x1;
                _0x488ba9 = 0x2;
            }
            break;
        case 'E':
            _0x5b5820 = 'D';
            _0x3ce9ca = 0x1;
            _0x488ba9 = _0x56d262['rank'] - 0x2;
            break;
        case 'S':
            _0x5b5820 = 'F';
            _0x3ce9ca = 0x1;
            _0x488ba9 = _0x56d262['rank'] - 0x2;
            break;
        case 'x':
            _0x5b5820 = 'R';
            _0x488ba9 = _0x56d262['rank'];
            break;
        case 'y':
            _0x5b5820 = 'U';
            _0x488ba9 = _0x56d262['rank'];
            break;
        case 'z':
            _0x5b5820 = 'F';
            _0x488ba9 = _0x56d262['rank'];
            break;
        default:
            console['log']('unknown\x20prefix\x20on\x20move\x20' + _0x1247c9 + '[' + _0xc0d09a + ',' + _0x5b6960 + ']');
            return;
        }
        if (_0x71b524) {
            let _0x36dc1c = Math['min'](_0x3d6b1a, _0x258e58);
            let _0x471d32 = Math['max'](_0x3d6b1a, _0x258e58);
            for (let _0x59888c = _0x36dc1c; _0x59888c <= _0x471d32; _0x59888c++) {
                this['performRawMove'](_0x56d262, _0x5b5820, _0x3ce9ca + _0x59888c, _0x479890, _0x4f50d8);
            }
        } else {
            for (let _0x3a4008 = 0x0; _0x3a4008 < _0x488ba9; _0x3a4008++) {
                this['performRawMove'](_0x56d262, _0x5b5820, _0x3ce9ca + _0x3a4008, _0x479890, _0x4f50d8);
            }
        }
    }
    static ['ProcessMoves'](_0x16bc4f, _0x597988) {
        let _0x1fd4bc = _0x597988['split'](/\n/);
        for (let _0x5608c4 = 0x0; _0x5608c4 < _0x1fd4bc['length']; _0x5608c4++) {
            let _0x332112 = _0x1fd4bc[_0x5608c4];
            if (_0x332112['indexOf']('/') > 0x0) {
                _0x332112 = _0x332112['substr'](0x0, _0x332112['indexOf']('/'));
            }
            _0x332112 = NxN_AlgHandler['getAllMoves'](_0x332112);
            if (_0x332112 == null) {
                continue;
            }
            for (let _0x52c24a = 0x0; _0x52c24a < _0x332112['length']; _0x52c24a++) {
                let _0x324f06 = _0x332112[_0x52c24a]['move'];
                if (_0x324f06['length'] == 0x0) {
                    continue;
                }
                let _0x19aa92 = NxN_AlgHandler['moveToFormal'](_0x324f06, _0x16bc4f['rank']);
                if (_0x19aa92 == ![]) {
                    continue;
                }
                this['PerformFormalMove'](_0x16bc4f, _0x19aa92['move']);
            }
        }
    }
}
NxN['faces'] = 'UDLRFB';
NxN['legalmoves'] = [
    'R',
    'U',
    'L',
    'F',
    'D',
    'B',
    '4Fw',
    '3Fw',
    '2Fw',
    'Fw',
    '6Rw',
    '5Rw',
    '4Rw',
    '2Rw',
    '3Rw',
    'Rw',
    'Rw',
    '6Lw',
    '5Lw',
    '4Lw',
    '2Lw',
    '3Lw',
    '2Lw',
    'Lw',
    '6Uw',
    '5Uw',
    '4Uw',
    '3Uw',
    '2Uw',
    'Uw',
    '6Dw',
    '5Dw',
    '4Dw',
    '3Dw',
    '2Dw',
    'Dw',
    '6Bw',
    '5Bw',
    '4Bw',
    '3Bw',
    '2Bw',
    'Bw',
    '6r',
    '5r',
    '4r',
    '3r',
    '2r',
    'r',
    '6u',
    '5u',
    '4u',
    '3u',
    '2u',
    'u',
    '6f',
    '5f',
    '4f',
    '3f',
    '2f',
    'f',
    '6l',
    '5l',
    '4l',
    '3l',
    '2l',
    'l',
    '6b',
    '5b',
    '4b',
    '3b',
    '2b',
    'b',
    '6d',
    '5d',
    '4d',
    '3d',
    '2d',
    'd',
    'M',
    'E',
    'S',
    '2R',
    '3R',
    '4R',
    '5R',
    '6R',
    '2L',
    '3L',
    '4L',
    '5L',
    '6L',
    '2D',
    '3D',
    '4D',
    '5D',
    '6D',
    '2B',
    '3B',
    '4B',
    '5B',
    '6B',
    '2F',
    '3F',
    '4F',
    '5F',
    '6F',
    '2U',
    '3U',
    '4U',
    '5U',
    '6U',
    'x',
    'y',
    'z',
    '.'
];
NxN['legalsuffix'] = [
    '\x27',
    '2',
    '3',
    '2\x27',
    '3\x27'
];
NxN['OLLHashTable'] = OLLHashTable;
NxN['F2L_FR_HashTable'] = F2L_FR_HashTable;
NxN['F2L_FL_HashTable'] = F2L_FL_HashTable;
NxN['F2L_BL_HashTable'] = F2L_BL_HashTable;
NxN['F2L_BR_HashTable'] = F2L_BR_HashTable;
NxN['PLLnewHashTable'] = PLLnewHashTable;
NxN['COLLHashTable'] = COLLHashTable;
NxN['CMLLHashTable'] = CMLLHashTable;
NxN['ZBLLHashTable'] = ZBLLHashTable;
NxN['hashes'] = {
    'cross': {
        'prestage': [],
        'poststage': [{
                'hash': {
                    'B': 0x6030,
                    'D': 0x412410,
                    'F': 0x5028,
                    'L': 0x3018,
                    'R': 0x4020,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7038,
                    'D': 0xe3fe38,
                    'F': 0x7038,
                    'L': 0x7038,
                    'R': 0x7038,
                    'U': 0x0
                }
            }]
    },
    'pair1': {
        'prestage': ['cross'],
        'poststage': [
            {
                'hash': {
                    'B': 0x6030,
                    'D': 0x492410,
                    'F': 0x5a2d,
                    'L': 0x3018,
                    'R': 0x24120,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7038,
                    'D': 0xfffe38,
                    'F': 0x7e3f,
                    'L': 0x7038,
                    'R': 0x3f1f8,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x6030,
                    'D': 0x2412410,
                    'F': 0x2d168,
                    'L': 0x361b,
                    'R': 0x4020,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7038,
                    'D': 0x7e3fe38,
                    'F': 0x3f1f8,
                    'L': 0x7e3f,
                    'R': 0x7038,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x361b0,
                    'D': 0x412412,
                    'F': 0x5028,
                    'L': 0x3018,
                    'R': 0x4824,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3f1f8,
                    'D': 0xe3fe3f,
                    'F': 0x7038,
                    'L': 0x7038,
                    'R': 0x7e3f,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x6c36,
                    'D': 0x412490,
                    'F': 0x5028,
                    'L': 0x1b0d8,
                    'R': 0x4020,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7e3f,
                    'D': 0xe3fff8,
                    'F': 0x7038,
                    'L': 0x3f1f8,
                    'R': 0x7038,
                    'U': 0x0
                }
            }
        ]
    },
    'pair2': {
        'prestage': ['cross'],
        'poststage': [
            {
                'hash': {
                    'B': 0x6030,
                    'D': 0x2492410,
                    'F': 0x2db6d,
                    'L': 0x361b,
                    'R': 0x24120,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7038,
                    'D': 0x7fffe38,
                    'F': 0x3ffff,
                    'L': 0x7e3f,
                    'R': 0x3f1f8,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x36db6,
                    'D': 0x412492,
                    'F': 0x5028,
                    'L': 0x1b0d8,
                    'R': 0x4824,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3ffff,
                    'D': 0xe3ffff,
                    'F': 0x7038,
                    'L': 0x3f1f8,
                    'R': 0x7e3f,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x361b0,
                    'D': 0x492412,
                    'F': 0x5a2d,
                    'L': 0x3018,
                    'R': 0x24924,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3f1f8,
                    'D': 0xfffe3f,
                    'F': 0x7e3f,
                    'L': 0x7038,
                    'R': 0x3ffff,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x6c36,
                    'D': 0x2412490,
                    'F': 0x2d168,
                    'L': 0x1b6db,
                    'R': 0x4020,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7e3f,
                    'D': 0x7e3fff8,
                    'F': 0x3f1f8,
                    'L': 0x3ffff,
                    'R': 0x7038,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x6c36,
                    'D': 0x492490,
                    'F': 0x5a2d,
                    'L': 0x1b0d8,
                    'R': 0x24120,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7e3f,
                    'D': 0xfffff8,
                    'F': 0x7e3f,
                    'L': 0x3f1f8,
                    'R': 0x3f1f8,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x361b0,
                    'D': 0x2412412,
                    'F': 0x2d168,
                    'L': 0x361b,
                    'R': 0x4824,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3f1f8,
                    'D': 0x7e3fe3f,
                    'F': 0x3f1f8,
                    'L': 0x7e3f,
                    'R': 0x7e3f,
                    'U': 0x0
                }
            }
        ]
    },
    'pair3': {
        'prestage': ['cross'],
        'poststage': [
            {
                'hash': {
                    'B': 0x36db6,
                    'D': 0x2412492,
                    'F': 0x2d168,
                    'L': 0x1b6db,
                    'R': 0x4824,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3ffff,
                    'D': 0x7e3ffff,
                    'F': 0x3f1f8,
                    'L': 0x3ffff,
                    'R': 0x7e3f,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x36db6,
                    'D': 0x492492,
                    'F': 0x5a2d,
                    'L': 0x1b0d8,
                    'R': 0x24924,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3ffff,
                    'D': 0xffffff,
                    'F': 0x7e3f,
                    'L': 0x3f1f8,
                    'R': 0x3ffff,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x361b0,
                    'D': 0x2492412,
                    'F': 0x2db6d,
                    'L': 0x361b,
                    'R': 0x24924,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3f1f8,
                    'D': 0x7fffe3f,
                    'F': 0x3ffff,
                    'L': 0x7e3f,
                    'R': 0x3ffff,
                    'U': 0x0
                }
            },
            {
                'hash': {
                    'B': 0x6c36,
                    'D': 0x2492490,
                    'F': 0x2db6d,
                    'L': 0x1b6db,
                    'R': 0x24120,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x7e3f,
                    'D': 0x7fffff8,
                    'F': 0x3ffff,
                    'L': 0x3ffff,
                    'R': 0x3f1f8,
                    'U': 0x0
                }
            }
        ]
    },
    'pair4': {
        'prestage': ['cross'],
        'poststage': [{
                'hash': {
                    'B': 0x36db6,
                    'D': 0x2492492,
                    'F': 0x2db6d,
                    'L': 0x1b6db,
                    'R': 0x24924,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x3ffff,
                    'D': 0x7ffffff,
                    'F': 0x3ffff,
                    'L': 0x3ffff,
                    'R': 0x3ffff,
                    'U': 0x0
                }
            }]
    },
    'oll': {
        'prestage': ['pair4'],
        'poststage': [{
                'hash': {
                    'B': 0x36db6,
                    'D': 0x2492492,
                    'F': 0x2db6d,
                    'L': 0x1b6db,
                    'R': 0x24924,
                    'U': 0x1249249
                },
                'mask': {
                    'B': 0x3ffff,
                    'D': 0x7ffffff,
                    'F': 0x3ffff,
                    'L': 0x3ffff,
                    'R': 0x3ffff,
                    'U': 0x7ffffff
                }
            }]
    },
    'pll': {
        'prestage': ['oll'],
        'poststage': [
            {
                'hash': {
                    'B': 0x6db6db6,
                    'D': 0x2492492,
                    'F': 0x5b6db6d,
                    'L': 0x36db6db,
                    'R': 0x4924924,
                    'U': 0x1249249
                },
                'mask': {
                    'B': 0x7ffffff,
                    'D': 0x7ffffff,
                    'F': 0x7ffffff,
                    'L': 0x7ffffff,
                    'R': 0x7ffffff,
                    'U': 0x7ffffff
                }
            },
            {
                'hash': {
                    'B': 0x36f6db6,
                    'D': 0x2492492,
                    'F': 0x492db6d,
                    'L': 0x5b5b6db,
                    'R': 0x6da4924,
                    'U': 0x1249249
                },
                'mask': {
                    'B': 0x7ffffff,
                    'D': 0x7ffffff,
                    'F': 0x7ffffff,
                    'L': 0x7ffffff,
                    'R': 0x7ffffff,
                    'U': 0x7ffffff
                }
            },
            {
                'hash': {
                    'B': 0x5b76db6,
                    'D': 0x2492492,
                    'F': 0x6dadb6d,
                    'L': 0x491b6db,
                    'R': 0x36e4924,
                    'U': 0x1249249
                },
                'mask': {
                    'B': 0x7ffffff,
                    'D': 0x7ffffff,
                    'F': 0x7ffffff,
                    'L': 0x7ffffff,
                    'R': 0x7ffffff,
                    'U': 0x7ffffff
                }
            },
            {
                'hash': {
                    'B': 0x4936db6,
                    'D': 0x2492492,
                    'F': 0x36edb6d,
                    'L': 0x6d9b6db,
                    'R': 0x5b64924,
                    'U': 0x1249249
                },
                'mask': {
                    'B': 0x7ffffff,
                    'D': 0x7ffffff,
                    'F': 0x7ffffff,
                    'L': 0x7ffffff,
                    'R': 0x7ffffff,
                    'U': 0x7ffffff
                }
            }
        ]
    },
    'FB': {
        'prestage': [],
        'poststage': [{
                'hash': {
                    'B': 0xc06,
                    'D': 0x2010080,
                    'F': 0x28140,
                    'L': 0x1b6db,
                    'R': 0x0,
                    'U': 0x0
                },
                'mask': {
                    'B': 0xe07,
                    'D': 0x70381c0,
                    'F': 0x381c0,
                    'L': 0x3ffff,
                    'R': 0x0,
                    'U': 0x0
                }
            }]
    },
    'SS': {
        'prestage': [],
        'poststage': [{
                'hash': {
                    'B': 0x30d86,
                    'D': 0x2010482,
                    'F': 0x28140,
                    'L': 0x1b6db,
                    'R': 0x4824,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x38fc7,
                    'D': 0x7038fc7,
                    'F': 0x381c0,
                    'L': 0x3ffff,
                    'R': 0x7e3f,
                    'U': 0x0
                }
            }]
    },
    'SB': {
        'prestage': [],
        'poststage': [{
                'hash': {
                    'B': 0x30d86,
                    'D': 0x2090482,
                    'F': 0x28b45,
                    'L': 0x1b6db,
                    'R': 0x24924,
                    'U': 0x0
                },
                'mask': {
                    'B': 0x38fc7,
                    'D': 0x71f8fc7,
                    'F': 0x38fc7,
                    'L': 0x3ffff,
                    'R': 0x3ffff,
                    'U': 0x0
                }
            }]
    },
    'CMLL': {
        'prestage': [],
        'poststage': [
            {
                'hash': {
                    'B': 0x61b0d86,
                    'D': 0x2090482,
                    'F': 0x5168b45,
                    'L': 0x30db6db,
                    'R': 0x4124924,
                    'U': 0x1040041
                },
                'mask': {
                    'B': 0x71f8fc7,
                    'D': 0x71f8fc7,
                    'F': 0x71f8fc7,
                    'L': 0x71fffff,
                    'R': 0x71fffff,
                    'U': 0x71c01c7
                }
            },
            {
                'hash': {
                    'B': 0x30f0d86,
                    'D': 0x2090482,
                    'F': 0x4128b45,
                    'L': 0x515b6db,
                    'R': 0x61a4924,
                    'U': 0x1040041
                },
                'mask': {
                    'B': 0x71f8fc7,
                    'D': 0x71f8fc7,
                    'F': 0x71f8fc7,
                    'L': 0x71fffff,
                    'R': 0x71fffff,
                    'U': 0x71c01c7
                }
            },
            {
                'hash': {
                    'B': 0x5170d86,
                    'D': 0x2090482,
                    'F': 0x61a8b45,
                    'L': 0x411b6db,
                    'R': 0x30e4924,
                    'U': 0x1040041
                },
                'mask': {
                    'B': 0x71f8fc7,
                    'D': 0x71f8fc7,
                    'F': 0x71f8fc7,
                    'L': 0x71fffff,
                    'R': 0x71fffff,
                    'U': 0x71c01c7
                }
            },
            {
                'hash': {
                    'B': 0x4130d86,
                    'D': 0x2090482,
                    'F': 0x30e8b45,
                    'L': 0x619b6db,
                    'R': 0x5164924,
                    'U': 0x1040041
                },
                'mask': {
                    'B': 0x71f8fc7,
                    'D': 0x71f8fc7,
                    'F': 0x71f8fc7,
                    'L': 0x71fffff,
                    'R': 0x71fffff,
                    'U': 0x71c01c7
                }
            }
        ]
    }
};
class NxN_AlgHandler {
    static ['InverseMoves'](_0x38bc4f) {
        let _0x53357f = [];
        for (let _0xb33d16 = _0x38bc4f['length'] - 0x1; _0x38bc4f['length'] > 0x0 && _0xb33d16 >= 0x0; _0xb33d16--) {
            if (NxN_AlgHandler['InvertMove'](_0x38bc4f[_0xb33d16]['move']) == null) {
                continue;
            }
            _0x53357f['push']({
                'move': NxN_AlgHandler['InvertMove'](_0x38bc4f[_0xb33d16]['move']),
                'index': _0x38bc4f[_0xb33d16]['index'],
                'islegal': _0x38bc4f[_0xb33d16]['islegal']
            });
        }
        return _0x53357f;
    }
    static ['getMoveType'](_0x3ee1ed) {
        if (_0x3ee1ed['trim']()['length'] == 0x0)
            return 'space';
        if (_0x3ee1ed['indexOf']('//') == 0x0)
            return 'comment';
        if ([
                'x',
                'y',
                'z'
            ]['includes'](_0x3ee1ed[0x0]))
            return 'rotation';
        return 'move';
    }
    static ['condenseAlg'](_0x236708, _0x52e63a = ![]) {
        let _0x6c5199 = this['getAllMovesStatic'](_0x236708);
        let _0x590d68 = '';
        let _0x1eacdb = ![];
        for (let _0x32cfac of _0x6c5199) {
            if (_0x32cfac['move']['indexOf']('\x0a') !== -0x1)
                continue;
            if (_0x52e63a && _0x1eacdb == ![] && 'xyz'['includes'](_0x32cfac['move'][0x0])) {
                continue;
            }
            _0x1eacdb = !![];
            _0x590d68 += _0x32cfac['move']['replaceAll']('2\x27', '2')['replaceAll']('3', '\x27');
        }
        return _0x590d68['trim']();
    }
    static ['GetPrefix'](_0x1a4050) {
        for (let _0x563636 = 0x0; _0x563636 < NxN['legalmoves']['length']; _0x563636++) {
            if (_0x1a4050 == NxN['legalmoves'][_0x563636]) {
                return NxN['legalmoves'][_0x563636];
            }
            for (let _0x478b2e = 0x0; _0x478b2e < NxN['legalsuffix']['length']; _0x478b2e++) {
                if (_0x1a4050 == NxN['legalmoves'][_0x563636] + NxN['legalsuffix'][_0x478b2e]) {
                    return NxN['legalmoves'][_0x563636];
                }
            }
        }
        return null;
    }
    static ['IsTroll'](_0x292ac4) {
        let _0x4eb0e7 = this['getAllMovesStatic'](_0x292ac4);
        if (_0x4eb0e7['count'] >= 0x1e)
            return !![];
        let _0xe90db8 = [];
        let _0x17075e = 0x0, _0x2d67a2 = 0x0, _0x1ca2c7 = 0x0;
        for (let _0x2747d7 = 0x0; _0x2747d7 < _0x4eb0e7['length']; _0x2747d7++) {
            let _0x319583 = this['GetPrefix'](_0x4eb0e7[_0x2747d7]['move'][0x0]);
            if (_0x319583 != 'x' && _0x319583 != 'y' && _0x319583 != 'z' && !_0xe90db8['includes'](_0x319583)) {
                _0xe90db8['push'](_0x319583);
            }
            if (_0x4eb0e7[_0x2747d7]['move'][0x0] == 'x')
                _0x17075e++;
            if (_0x4eb0e7[_0x2747d7]['move'][0x0] == 'y')
                _0x2d67a2++;
            if (_0x4eb0e7[_0x2747d7]['move'][0x0] == 'z')
                _0x1ca2c7++;
        }
        if (_0x17075e > 0x3 || _0x2d67a2 > 0x3 || _0x1ca2c7 > 0x3 || _0xe90db8['length'] > 0x7)
            return !![];
        return ![];
    }
    static ['condenseAlgSCDB'](_0x39e5d8, _0x47ad4c = ![]) {
        let _0x30e6ef = this['getAllMovesStatic'](_0x39e5d8);
        let _0x39afc3 = '';
        let _0x26507d = ![];
        for (let _0x4d3080 = 0x0; _0x4d3080 < _0x30e6ef['length']; _0x4d3080++) {
            let _0x46ad7c = _0x30e6ef[_0x4d3080]['move']['replaceAll']('2\x27', '2')['replaceAll']('3\x27', '')['replaceAll']('3', '\x27')['replaceAll']('Rw', 'r')['replaceAll']('Rw', 'u')['replaceAll']('Rw', 'f')['replaceAll']('Rw', 'b')['replaceAll']('Rw', 'd')['replaceAll']('Rw', 'l');
            if (_0x46ad7c['indexOf']('\x0a') !== -0x1)
                continue;
            let _0x41a99f = this['GetPrefix'](_0x46ad7c);
            while (_0x4d3080 + 0x1 < _0x30e6ef['length'] && _0x41a99f == this['GetPrefix'](_0x30e6ef[_0x4d3080 + 0x1]['move'])) {
                let _0x363393 = 0x0;
                if (_0x46ad7c['indexOf']('\x27', _0x41a99f['length']) != -0x1)
                    _0x363393 = -0x1;
                else if (_0x46ad7c['indexOf']('2', _0x41a99f['length']) != -0x1)
                    _0x363393 = 0x2;
                else if (_0x46ad7c['indexOf']('3', _0x41a99f['length']) != -0x1)
                    _0x363393 = 0x3;
                else if (_0x46ad7c == _0x41a99f)
                    _0x363393++;
                if (_0x30e6ef[_0x4d3080 + 0x1]['move']['indexOf']('\x27', _0x41a99f['length']) != -0x1)
                    _0x363393 += -0x1;
                else if (_0x30e6ef[_0x4d3080 + 0x1]['move']['indexOf']('2', _0x41a99f['length']) !== -0x1)
                    _0x363393 += 0x2;
                else if (_0x30e6ef[_0x4d3080 + 0x1]['move']['indexOf']('3', _0x41a99f['length']) != -0x1)
                    _0x363393 += 0x3;
                else if (_0x30e6ef[_0x4d3080 + 0x1]['move'] == _0x41a99f)
                    _0x363393++;
                if (_0x363393 < -0x1)
                    _0x363393 = 0x4 - _0x363393;
                _0x363393 = _0x363393 % 0x4;
                switch (_0x363393) {
                case -0x3:
                case 0x3:
                case -0x1:
                    _0x46ad7c = _0x41a99f + '\x27';
                    break;
                case 0x0:
                    _0x46ad7c = '';
                    break;
                case 0x1:
                    _0x46ad7c = _0x41a99f;
                    break;
                case -0x2:
                case 0x2:
                    _0x46ad7c = _0x41a99f + '2';
                    break;
                }
                _0x4d3080++;
            }
            _0x26507d = !![];
            if (_0x47ad4c && _0x4d3080 > 0x0)
                _0x39afc3 += '\x20';
            _0x39afc3 += _0x46ad7c;
        }
        return _0x39afc3['trim']();
    }
    static ['getAllMoves'](_0x574d8a, _0x563226 = '') {
        let _0xa48680 = [];
        let _0x3dd0ba = [];
        let _0x1771b6 = [];
        let _0x13e552 = '';
        let _0x251a49 = _0x574d8a['matchAll'](NxN['movesRegex']);
        let _0x362a5c = [];
        for (const _0x2c522c of _0x251a49) {
            _0x362a5c['push']([
                _0x2c522c[0x0],
                _0x2c522c['index']
            ]);
        }
        let _0x133e86 = -0x1;
        for (let _0x2d145f = 0x0; _0x2d145f < _0x362a5c['length']; _0x2d145f++) {
            if (_0x362a5c[_0x2d145f][0x1] <= _0x133e86) {
                continue;
            }
            switch (_0x362a5c[_0x2d145f][0x0][0x0]) {
            case '/':
                break;
            case '[':
                _0x3dd0ba = [];
                _0x1771b6 = [];
                _0x13e552 = '';
                if (_0x362a5c['length'] <= _0x2d145f + 0x1) {
                    return _0xa48680;
                }
                let _0x1bca19 = NxN_AlgHandler['getAllMoves'](_0x574d8a['substring'](_0x362a5c[_0x2d145f + 0x1][0x1]), '[');
                for (let _0x37fa56 = 0x0; _0x37fa56 < _0x1bca19['length']; _0x37fa56++) {
                    let _0x59f0ec = _0x1bca19[_0x37fa56]['index'] + _0x362a5c[_0x2d145f + 0x1][0x1];
                    if (_0x1bca19[_0x37fa56]['move'] == ':' || _0x1bca19[_0x37fa56]['move'] == ',') {
                        _0x13e552 = _0x1bca19[_0x37fa56]['move'];
                    } else if (_0x13e552 == '') {
                        _0x3dd0ba['push']({
                            'move': _0x1bca19[_0x37fa56]['move'],
                            'index': _0x59f0ec,
                            'islegal': _0x1bca19[_0x37fa56]['islegal']
                        });
                    } else {
                        _0x1771b6['push']({
                            'move': _0x1bca19[_0x37fa56]['move'],
                            'index': _0x59f0ec,
                            'islegal': _0x1bca19[_0x37fa56]['islegal']
                        });
                    }
                    if (_0x59f0ec + _0x1bca19[_0x37fa56]['move']['length'] - 0x1 > _0x133e86) {
                        _0x133e86 = _0x59f0ec + _0x1bca19[_0x37fa56]['move']['length'] - 0x1;
                    }
                }
                let _0x2e6c59 = [];
                _0x2e6c59['push']({
                    'move': _0x362a5c[_0x2d145f][0x0],
                    'index': _0x362a5c[_0x2d145f][0x1],
                    'islegal': ![]
                });
                if (_0x3dd0ba['length'] > 0x0) {
                    _0x2e6c59 = _0x2e6c59['concat'](_0x3dd0ba);
                }
                if (_0x1771b6['length'] > 0x0) {
                    _0x2e6c59 = _0x2e6c59['concat'](_0x1771b6);
                }
                if (_0x3dd0ba['length'] > 0x0 && _0x13e552 != '') {
                    _0x2e6c59 = _0x2e6c59['concat'](this['InverseMoves'](_0x3dd0ba));
                }
                if (_0x1771b6['length'] > 0x0 && _0x13e552 == ',') {
                    _0x2e6c59 = _0x2e6c59['concat'](this['InverseMoves'](_0x1771b6));
                }
                _0xa48680 = _0xa48680['concat'](_0x2e6c59);
                break;
            case ']':
                if (_0x563226 != '[') {
                    _0xa48680['push']({
                        'move': _0x362a5c[_0x2d145f][0x0],
                        'index': _0x362a5c[_0x2d145f][0x1],
                        'islegal': ![]
                    });
                    continue;
                }
                _0xa48680['push']({
                    'move': _0x362a5c[_0x2d145f][0x0],
                    'index': _0x362a5c[_0x2d145f][0x1],
                    'islegal': !![]
                });
                for (let _0x1ce81f = 0x0; _0x1ce81f < _0xa48680['length']; _0x1ce81f++) {
                    _0xa48680[_0x1ce81f]['moveindex'] = _0x1ce81f;
                    _0xa48680[_0x1ce81f]['totalindex'] = _0xa48680['length'];
                }
                return _0xa48680;
            case '(':
                if (_0x362a5c['length'] <= _0x2d145f + 0x1) {
                    return _0xa48680;
                }
                _0xa48680['push']({
                    'move': _0x362a5c[_0x2d145f][0x0],
                    'index': _0x362a5c[_0x2d145f][0x1],
                    'islegal': ![]
                });
                let _0x1321ca = NxN_AlgHandler['getAllMoves'](_0x574d8a['substring'](_0x362a5c[_0x2d145f + 0x1][0x1]), '(');
                for (let _0x1ce655 = 0x0; _0x1ce655 < _0x1321ca['length']; _0x1ce655++) {
                    let _0xc4b21f = _0x1321ca[_0x1ce655]['index'] + _0x362a5c[_0x2d145f + 0x1][0x1];
                    _0xa48680['push']({
                        'move': _0x1321ca[_0x1ce655]['move'],
                        'index': _0xc4b21f,
                        'islegal': _0x1321ca[_0x1ce655]['islegal'],
                        'subqueue': _0x1ce655
                    });
                    if (_0xc4b21f + _0x1321ca[_0x1ce655]['move']['length'] - 0x1 > _0x133e86) {
                        _0x133e86 = _0xc4b21f + _0x1321ca[_0x1ce655]['move']['length'] - 0x1;
                    }
                }
                break;
            case ')':
                if (_0x563226 != '(') {
                    _0xa48680['push']({
                        'move': _0x362a5c[_0x2d145f][0x0],
                        'index': _0x362a5c[_0x2d145f][0x1],
                        'islegal': ![]
                    });
                    continue;
                }
                if (_0x362a5c[_0x2d145f][0x0]['length'] > 0x1) {
                    let _0x4c936d = _0x362a5c[_0x2d145f][0x0]['substring'](0x1);
                    let _0x377857 = [];
                    for (let _0x5f1cb5 = 0x0; _0x5f1cb5 < _0x4c936d; _0x5f1cb5++) {
                        _0x377857 = _0x377857['concat'](_0xa48680);
                    }
                    _0x377857['push']({
                        'move': _0x362a5c[_0x2d145f][0x0],
                        'index': _0x362a5c[_0x2d145f][0x1],
                        'islegal': !![]
                    });
                    _0xa48680['push']({
                        'move': _0x362a5c[_0x2d145f][0x0],
                        'index': _0x362a5c[_0x2d145f][0x1],
                        'islegal': !![]
                    });
                    for (let _0x2c3518 = 0x0; _0x2c3518 < _0x377857['length']; _0x2c3518++) {
                        _0x377857[_0x2c3518]['moveindex'] = _0x2c3518;
                        _0x377857[_0x2c3518]['totalindex'] = _0x377857['length'];
                    }
                    return _0x377857;
                } else {
                    _0xa48680['push']({
                        'move': _0x362a5c[_0x2d145f][0x0],
                        'index': _0x362a5c[_0x2d145f][0x1],
                        'islegal': !![]
                    });
                    for (let _0x746f72 = 0x0; _0x746f72 < _0xa48680['length']; _0x746f72++) {
                        _0xa48680[_0x746f72]['moveindex'] = _0x746f72;
                        _0xa48680[_0x746f72]['totalindex'] = _0xa48680['length'];
                    }
                    return _0xa48680;
                }
                break;
            default:
                _0xa48680['push']({
                    'move': _0x362a5c[_0x2d145f][0x0],
                    'index': _0x362a5c[_0x2d145f][0x1],
                    'islegal': !![]
                });
                break;
            }
        }
        for (let _0x68e9d6 = 0x0; _0x68e9d6 < _0xa48680['length']; _0x68e9d6++) {
            _0xa48680[_0x68e9d6]['moveindex'] = _0x68e9d6;
            _0xa48680[_0x68e9d6]['totalindex'] = _0xa48680['length'];
        }
        return _0xa48680;
    }
    static ['getAllMovesStatic'](_0x4ed87b, _0x56a75b = 0x0) {
        let _0x2426ea = [];
        let _0x5e6802 = NxN_AlgHandler['getAllMoves'](_0x4ed87b);
        let _0x1bd183 = _0x4ed87b['matchAll'](NxN['movesRegex']);
        let _0x33ceb9 = [];
        for (const _0x4d71a1 of _0x1bd183) {
            _0x33ceb9['push']([
                _0x4d71a1[0x0],
                _0x4d71a1['index']
            ]);
        }
        for (let _0x12564a = 0x0; _0x12564a < _0x33ceb9['length']; _0x12564a++) {
            let _0x29dfc8 = [];
            for (let _0x35a8b9 = 0x0; _0x35a8b9 < _0x5e6802['length']; _0x35a8b9++) {
                if (_0x5e6802[_0x35a8b9]['index'] == _0x33ceb9[_0x12564a][0x1])
                    _0x29dfc8['push'](_0x5e6802[_0x35a8b9]['moveindex'] + _0x56a75b);
            }
            _0x2426ea['push']({
                'move': _0x33ceb9[_0x12564a][0x0],
                'index': _0x33ceb9[_0x12564a][0x1],
                'moveindex': _0x29dfc8,
                'islegal': !![]
            });
        }
        return _0x2426ea;
    }
    static ['removeOuterParenthasis'](_0x5c0da6) {
        _0x5c0da6 = _0x5c0da6['substring'](0x0, _0x5c0da6['lastIndexOf'](')'));
        _0x5c0da6 = _0x5c0da6['substring'](_0x5c0da6['indexOf']('(') + 0x1);
        return _0x5c0da6;
    }
    static ['removeOuterBrackets'](_0x2788cd) {
        _0x2788cd = _0x2788cd['substring'](0x0, _0x2788cd['lastIndexOf'](']'));
        _0x2788cd = _0x2788cd['substring'](_0x2788cd['indexOf']('[') + 0x1);
        return _0x2788cd;
    }
    static ['encodeAlg'](_0x1d6867) {
        _0x1d6867 = _0x1d6867['replaceAll']('-', '%2D')['replaceAll']('\x20', '_')['replaceAll']('\x27', '-')['replaceAll']('(', '%28')['replaceAll'](')', '%29');
        return encodeURIComponent(_0x1d6867);
    }
    static ['moveToFormal'](_0x4dd2a4, _0x1b3318) {
        if (_0x4dd2a4 == undefined || _0x4dd2a4['length'] == 0x0 || _0x4dd2a4[0x0] == '(' || _0x4dd2a4[0x0] == ')' || _0x4dd2a4[0x0] == '}' || _0x4dd2a4[0x0] == '{' || _0x4dd2a4[0x0] == '[' || _0x4dd2a4[0x0] == ']' || _0x4dd2a4[0x0] == '/') {
            return ![];
        }
        _0x4dd2a4 = _0x4dd2a4['trim']();
        let _0x103efb, _0xe063f5, _0x395fee, _0x4c912c, _0x2b7091 = 0x1;
        let _0x387ae1 = '';
        let _0x4a9efa = '';
        let _0x358633 = _0x4dd2a4;
        let _0xf691ae = ![];
        let _0x317bcf = 0x0;
        let _0x31872e = 0x0;
        if ('1234567'['includes'](_0x4dd2a4[0x0]) && _0x4dd2a4[0x1] == '-' && '1234567'['includes'](_0x4dd2a4[0x2]) && ('RULDFB'['includes'](_0x4dd2a4[0x3]) && _0x4dd2a4[0x4] == 'w' || 'ruldfb'['includes'](_0x4dd2a4[0x3]))) {
            _0xf691ae = !![];
            _0x317bcf = Number(_0x4dd2a4[0x0]) - 0x1;
            _0x31872e = Number(_0x4dd2a4[0x2]) - 0x1;
            if (_0x317bcf < _0x31872e) {
                let _0x677995 = _0x317bcf;
                _0x317bcf = _0x31872e;
                _0x31872e = _0x677995;
            }
            _0x4dd2a4 = _0x4dd2a4['substring'](0x3);
        }
        for (let _0x223731 = 0x0; _0x223731 < NxN['legalmoves']['length']; _0x223731++) {
            if (_0x4dd2a4 == NxN['legalmoves'][_0x223731]) {
                _0x387ae1 = NxN['legalmoves'][_0x223731];
                break;
            }
            if (_0x4dd2a4[0x0] != NxN['legalmoves'][_0x223731][0x0]) {
                break;
            }
            for (let _0x469b3f = 0x0; _0x469b3f < NxN['legalsuffix']['length']; _0x469b3f++) {
                if (_0x4dd2a4 == NxN['legalmoves'][_0x223731] + NxN['legalsuffix'][_0x469b3f]) {
                    _0x387ae1 = NxN['legalmoves'][_0x223731];
                    _0x4a9efa = NxN['legalsuffix'][_0x469b3f];
                    break;
                }
            }
        }
        switch (_0x387ae1) {
        case 'x':
            _0x103efb = 'x';
            _0xe063f5 = 0x0;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case 'y':
            _0x103efb = 'y';
            _0xe063f5 = 0x0;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case 'z':
            _0x103efb = 'z';
            _0xe063f5 = 0x0;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case 'R':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x1;
            break;
        case '2R':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x2;
            break;
        case '3R':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x3;
            break;
        case '4R':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x4;
            break;
        case '5R':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x5;
            break;
        case '6R':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x6;
            break;
        case 'L':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = 0x0;
            _0x2b7091 = -0x1;
            break;
        case '2L':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = 0x1;
            _0x2b7091 = -0x1;
            break;
        case '3L':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = 0x2;
            _0x2b7091 = -0x1;
            break;
        case '4L':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = 0x3;
            _0x2b7091 = -0x1;
            break;
        case '5L':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = 0x4;
            _0x2b7091 = -0x1;
            break;
        case '6L':
            _0x103efb = 'x';
            _0xe063f5 = _0x395fee = 0x5;
            _0x2b7091 = -0x1;
            break;
        case 'U':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = 0x0;
            break;
        case '2U':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = 0x1;
            break;
        case '3U':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = 0x2;
            break;
        case '4U':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = 0x3;
            break;
        case '5U':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = 0x4;
            break;
        case '6U':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = 0x5;
            break;
        case 'D':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x1;
            _0x2b7091 = -0x1;
            break;
        case '2D':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x2;
            _0x2b7091 = -0x1;
            break;
        case '3D':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x3;
            _0x2b7091 = -0x1;
            break;
        case '4D':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x4;
            _0x2b7091 = -0x1;
            break;
        case '5D':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x5;
            _0x2b7091 = -0x1;
            break;
        case '6D':
            _0x103efb = 'y';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x6;
            _0x2b7091 = -0x1;
            break;
        case 'F':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x1;
            break;
        case '2F':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x2;
            break;
        case '3F':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x3;
            break;
        case '4F':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x4;
            break;
        case '5F':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x5;
            break;
        case '6F':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = _0x1b3318 - 0x6;
            break;
        case 'B':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = 0x0;
            _0x2b7091 = -0x1;
            break;
        case '2B':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = 0x1;
            _0x2b7091 = -0x1;
            break;
        case '3B':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = 0x2;
            _0x2b7091 = -0x1;
            break;
        case '4B':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = 0x3;
            _0x2b7091 = -0x1;
            break;
        case '5B':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = 0x4;
            _0x2b7091 = -0x1;
            break;
        case '6B':
            _0x103efb = 'z';
            _0xe063f5 = _0x395fee = 0x5;
            _0x2b7091 = -0x1;
            break;
        case 'r':
        case '2r':
        case 'Rw':
        case '2Rw':
            _0x103efb = 'x';
            _0xe063f5 = _0x1b3318 - 0x2;
            _0x395fee = _0x1b3318 - 0x1;
            if (_0xf691ae) {
                _0xe063f5 = _0x1b3318 - 0x1 - _0x31872e;
                _0x395fee = _0x1b3318 - 0x1 - _0x317bcf;
            }
            break;
        case '3r':
        case '3Rw':
            _0x103efb = 'x';
            _0xe063f5 = _0x1b3318 - 0x3;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case '4r':
        case '4Rw':
            _0x103efb = 'x';
            _0xe063f5 = _0x1b3318 - 0x4;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case '5r':
        case '5Rw':
            _0x103efb = 'x';
            _0xe063f5 = _0x1b3318 - 0x5;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case '6r':
        case '6Rw':
            _0x103efb = 'x';
            _0xe063f5 = _0x1b3318 - 0x6;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case 'l':
        case '2l':
        case 'Lw':
        case '2Lw':
            _0x103efb = 'x';
            _0xe063f5 = 0x0;
            _0x395fee = 0x1;
            _0x2b7091 = -0x1;
            if (_0xf691ae) {
                _0xe063f5 = _0x317bcf;
                _0x395fee = _0x31872e;
            }
            break;
        case '3l':
        case '3Lw':
            _0x103efb = 'x';
            _0xe063f5 = 0x0;
            _0x395fee = 0x2;
            _0x2b7091 = -0x1;
            break;
        case '4l':
        case '4Lw':
            _0x103efb = 'x';
            _0xe063f5 = 0x0;
            _0x395fee = 0x3;
            _0x2b7091 = -0x1;
            break;
        case '5l':
        case '5Lw':
            _0x103efb = 'x';
            _0xe063f5 = 0x0;
            _0x395fee = 0x4;
            _0x2b7091 = -0x1;
            break;
        case '6l':
        case '6Lw':
            _0x103efb = 'x';
            _0xe063f5 = 0x0;
            _0x395fee = 0x5;
            _0x2b7091 = -0x1;
            break;
        case 'u':
        case '2u':
        case 'Uw':
        case '2Uw':
            _0x103efb = 'y';
            _0xe063f5 = 0x0;
            _0x395fee = 0x1;
            if (_0xf691ae) {
                _0xe063f5 = _0x317bcf;
                _0x395fee = _0x31872e;
            }
            break;
        case '3u':
        case '3Uw':
            _0x103efb = 'y';
            _0xe063f5 = 0x0;
            _0x395fee = 0x2;
            break;
        case '4u':
        case '4Uw':
            _0x103efb = 'y';
            _0xe063f5 = 0x0;
            _0x395fee = 0x3;
            break;
        case '5u':
        case '5Uw':
            _0x103efb = 'y';
            _0xe063f5 = 0x0;
            _0x395fee = 0x4;
            break;
        case '6u':
        case '6Uw':
            _0x103efb = 'y';
            _0xe063f5 = 0x0;
            _0x395fee = 0x5;
            break;
        case 'd':
        case '2d':
        case 'Dw':
        case '2Dw':
            _0x103efb = 'y';
            _0xe063f5 = _0x1b3318 - 0x2;
            _0x395fee = _0x1b3318 - 0x1;
            _0x2b7091 = -0x1;
            if (_0xf691ae) {
                _0xe063f5 = _0x1b3318 - 0x1 - _0x31872e;
                _0x395fee = _0x1b3318 - 0x1 - _0x317bcf;
            }
            break;
        case '3d':
        case '3Dw':
            _0x103efb = 'y';
            _0xe063f5 = _0x1b3318 - 0x3;
            _0x395fee = _0x1b3318 - 0x1;
            _0x2b7091 = -0x1;
            break;
        case '4d':
        case '4Dw':
            _0x103efb = 'y';
            _0xe063f5 = _0x1b3318 - 0x4;
            _0x395fee = _0x1b3318 - 0x1;
            _0x2b7091 = -0x1;
            break;
        case '5d':
        case '5Dw':
            _0x103efb = 'y';
            _0xe063f5 = _0x1b3318 - 0x5;
            _0x395fee = _0x1b3318 - 0x1;
            _0x2b7091 = -0x1;
            break;
        case '6d':
        case '6Dw':
            _0x103efb = 'y';
            _0xe063f5 = _0x1b3318 - 0x6;
            _0x395fee = _0x1b3318 - 0x1;
            _0x2b7091 = -0x1;
            break;
        case 'f':
        case '2f':
        case 'Fw':
        case '2Fw':
            _0x103efb = 'z';
            _0xe063f5 = _0x1b3318 - 0x2;
            _0x395fee = _0x1b3318 - 0x1;
            if (_0xf691ae) {
                _0xe063f5 = _0x1b3318 - 0x1 - _0x31872e;
                _0x395fee = _0x1b3318 - 0x1 - _0x317bcf;
            }
            break;
        case '3f':
        case '3Fw':
            _0x103efb = 'z';
            _0xe063f5 = _0x1b3318 - 0x3;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case '4f':
        case '4Fw':
            _0x103efb = 'z';
            _0xe063f5 = _0x1b3318 - 0x4;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case '5f':
        case '5Fw':
            _0x103efb = 'z';
            _0xe063f5 = _0x1b3318 - 0x5;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case '6f':
        case '6Fw':
            _0x103efb = 'z';
            _0xe063f5 = _0x1b3318 - 0x6;
            _0x395fee = _0x1b3318 - 0x1;
            break;
        case 'b':
        case '2b':
        case 'Bw':
        case '2Bw':
            _0x103efb = 'z';
            _0xe063f5 = 0x0;
            _0x395fee = 0x1;
            _0x2b7091 = -0x1;
            if (_0xf691ae) {
                _0xe063f5 = _0x317bcf;
                _0x395fee = _0x31872e;
            }
            break;
        case '3b':
        case '3Bw':
            _0x103efb = 'z';
            _0xe063f5 = 0x0;
            _0x395fee = 0x2;
            _0x2b7091 = -0x1;
            break;
        case '4b':
        case '4Bw':
            _0x103efb = 'z';
            _0xe063f5 = 0x0;
            _0x395fee = 0x3;
            _0x2b7091 = -0x1;
            break;
        case '5b':
        case '5Bw':
            _0x103efb = 'z';
            _0xe063f5 = 0x0;
            _0x395fee = 0x4;
            _0x2b7091 = -0x1;
            break;
        case '6b':
        case '6Bw':
            _0x103efb = 'z';
            _0xe063f5 = 0x0;
            _0x395fee = 0x5;
            _0x2b7091 = -0x1;
            break;
        case 'M':
            _0x103efb = 'x';
            _0xe063f5 = 0x1;
            _0x395fee = _0x1b3318 - 0x2;
            _0x2b7091 = -0x1;
            break;
        case 'E':
            _0x103efb = 'y';
            _0xe063f5 = 0x1;
            _0x395fee = _0x1b3318 - 0x2;
            _0x2b7091 = -0x1;
            break;
        case 'S':
            _0x103efb = 'z';
            _0xe063f5 = 0x1;
            _0x395fee = _0x1b3318 - 0x2;
            break;
        case '\x0a':
        case '.':
            _0x103efb = '\x20';
            _0xe063f5 = _0x395fee = -0x1;
            break;
        }
        switch (_0x4a9efa) {
        case '\x27':
            _0x4c912c = -0x1;
            break;
        case '2\x27':
            _0x4c912c = -0x2;
            break;
        case '2':
            _0x4c912c = 0x2;
            break;
        case '3':
            _0x4c912c = 0x3;
            break;
        case '3\x27':
            _0x4c912c = -0x3;
            break;
        case '2':
            _0x4c912c = 0x2;
            break;
        default:
            _0x4c912c = 0x1;
            break;
        }
        if (_0xe063f5 > _0x395fee) {
            let _0x2288c1 = _0xe063f5;
            _0xe063f5 = _0x395fee;
            _0x395fee = _0x2288c1;
        }
        let _0x55f3df = {
            'move': _0x358633,
            'axis': _0x103efb,
            'fromslice': _0xe063f5,
            'toslice': _0x395fee,
            'amount': _0x4c912c * _0x2b7091,
            'clockwise': _0x2b7091
        };
        return _0x55f3df;
    }
    static ['calculateAllStats'](_0xf5dab9, _0x7288f2) {
        let _0x2cefe9 = 0x0;
        let _0x5df416 = 0x0;
        let _0x131b7d = 0x0;
        let _0x5ca7ec = 0x0;
        if (_0xf5dab9 == null || _0xf5dab9['length'] == 0x0) {
            return {
                'STM': 0x0,
                'HTM': 0x0,
                'QTM': 0x0,
                'ETM': 0x0
            };
        }
        let _0x7c3320 = 0x0;
        let _0x2b088e = NxN_AlgHandler['getAllMoves'](_0xf5dab9);
        for (const _0x3ed1f9 of _0x2b088e) {
            if (_0x3ed1f9['move'][0x0] != '/') {
                let _0xc5bbfe = _0x3ed1f9['move'];
                if (_0xc5bbfe == '\x0a') {
                    continue;
                }
                let _0x529376 = NxN_AlgHandler['moveToFormal'](_0xc5bbfe, _0x7288f2);
                if (_0x529376 == ![]) {
                    continue;
                }
                _0x2cefe9++;
                if (_0x3ed1f9['move'][0x0] != 'x' && _0x3ed1f9['move'][0x0] != 'y' && _0x3ed1f9['move'][0x0] != 'z') {
                    _0x5df416++;
                    _0x5ca7ec++;
                    _0x131b7d += Math['abs'](_0x529376['amount']);
                    if (_0x529376['fromslice'] > 0x0 && _0x529376['toslice'] < _0x7288f2 - 0x1) {
                        _0x5ca7ec++;
                        _0x131b7d += Math['abs'](_0x529376['amount']);
                    }
                }
            }
        }
        return {
            'STM': _0x5df416,
            'HTM': _0x5ca7ec,
            'QTM': _0x131b7d,
            'ETM': _0x2cefe9
        };
    }
    static ['calculateETM'](_0x20a99b) {
        if (_0x20a99b == null || _0x20a99b['length'] == 0x0) {
            return 0x0;
        }
        let _0x4a4921 = 0x0;
        let _0x36d3cb = NxN_AlgHandler['getAllMoves'](_0x20a99b);
        for (const _0xd7d162 of _0x36d3cb) {
            if (_0xd7d162['move'][0x0] != '/' && _0xd7d162['move'] != '\x0a' && _0xd7d162['move']['toLowerCase']() != '\x0aor') {
                let _0xdacf0d = _0xd7d162['move'];
                let _0x353b74 = NxN_AlgHandler['moveToFormal'](_0xdacf0d, this['rank']);
                if (_0x353b74 == ![]) {
                    continue;
                }
                _0x4a4921++;
            }
        }
        return _0x4a4921;
    }
    static ['RotateMovesX'](_0x44240c) {
        let _0x4f724f = '';
        if (_0x44240c == null || _0x44240c['length'] == 0x0) {
            return '';
        }
        let _0x16142a = !![];
        let _0x2143a5 = NxN_AlgHandler['getAllMoves'](_0x44240c);
        for (const _0x326787 of _0x2143a5) {
            let _0x3aab6c = _0x326787['move'];
            if (_0x3aab6c[0x0] == '/' || _0x3aab6c == '\x0a') {
                _0x4f724f += _0x3aab6c;
                continue;
            }
            let _0x3bb83e = NxN_AlgHandler['moveToFormal'](_0x3aab6c, this['rank']);
            if (_0x3bb83e == ![]) {
                continue;
            }
            if (_0x16142a) {
                const _0x369a0b = {
                    'x': 'x2\x20',
                    'x2': 'x\x27\x20',
                    'x\x27': '\x20'
                };
                _0x16142a = ![];
                if (_0x369a0b['hasOwnProperty'](_0x3aab6c)) {
                    _0x4f724f += _0x369a0b[_0x3aab6c];
                } else
                    _0x4f724f += 'x\x20' + this['RotateMoveX'](_0x3aab6c) + '\x20';
            } else {
                _0x4f724f += this['RotateMoveX'](_0x3aab6c) + '\x20';
            }
        }
        return _0x4f724f;
    }
    static ['RotateMoveX'](_0x41b4a1) {
        if (_0x41b4a1 == undefined || _0x41b4a1['length'] == 0x0) {
            return ![];
        }
        if (NxN_AlgHandler['Memes']['includes'](_0x41b4a1)) {
            return _0x41b4a1;
        }
        _0x41b4a1 = _0x41b4a1['trim']();
        let _0x1bf85b = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            '6Fw',
            '5Fw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '6Rw',
            '5Rw',
            '4Rw',
            '3Rw',
            '2Rw',
            'Rw',
            '6Lw',
            '5Lw',
            '4Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '6Uw',
            '5Uw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '6Dw',
            '5Dw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '6Bw',
            '5Bw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '6r',
            '5r',
            '4r',
            '3r',
            '2r',
            'r',
            '6u',
            '5u',
            '4u',
            '3u',
            '2u',
            'u',
            '6f',
            '5f',
            '4f',
            '3f',
            '2f',
            'f',
            '6l',
            '5l',
            '4l',
            '3l',
            '2l',
            'l',
            '6b',
            '5b',
            '4b',
            '3b',
            '2b',
            'b',
            '6d',
            '5d',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '5R',
            '6R',
            '2L',
            '3L',
            '4L',
            '5L',
            '6L',
            '2F',
            '3F',
            '4F',
            '5F',
            '6F',
            '2D',
            '3D',
            '4D',
            '5D',
            '6D',
            '2U',
            '3U',
            '4U',
            '5U',
            '6U',
            '2B',
            '3B',
            '4B',
            '5B',
            '6B',
            'x',
            'y',
            'z',
            '.'
        ];
        let _0x59a981 = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x33d6a0 = [
            'R',
            'B',
            'L',
            'U',
            'F',
            'D',
            '6Uw',
            '5Uw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '6Rw',
            '5Rw',
            '4Rw',
            '3Rw',
            '2Rw',
            'Rw',
            '6Lw',
            '5Lw',
            '4Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '6Bw',
            '5Bw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '6Fw',
            '5Fw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '6Dw',
            '5Dw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '6r',
            '5r',
            '4r',
            '3r',
            '2r',
            'r',
            '6b',
            '5b',
            '4b',
            '3b',
            '2b',
            'b',
            '6u',
            '5u',
            '4u',
            '3u',
            '2u',
            'u',
            '6l',
            '5l',
            '4l',
            '3l',
            '2l',
            'l',
            '6d',
            '5d',
            '4d',
            '3d',
            '2d',
            'd',
            '6f',
            '5f',
            '4f',
            '3f',
            '2f',
            'f',
            'M',
            'S',
            'E',
            '2R',
            '3R',
            '4R',
            '5R',
            '6R',
            '2L',
            '3L',
            '4L',
            '5L',
            '6L',
            '2D',
            '3D',
            '4D',
            '5D',
            '6D',
            '2B',
            '3B',
            '4B',
            '5B',
            '6B',
            '2F',
            '3F',
            '4F',
            '5F',
            '6F',
            '2U',
            '3U',
            '4U',
            '5U',
            '6U',
            'x',
            'z',
            'y',
            '.'
        ];
        let _0x200120 = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x58513f = [
            '\x27',
            '',
            '2',
            '3\x27',
            '2',
            '3'
        ];
        let _0x49ef8b = ![];
        let _0x125ecf = 0x0;
        let _0x2da6f6 = 0x0;
        if ('1234567'['includes'](_0x41b4a1[0x0]) && _0x41b4a1[0x1] == '-' && '1234567'['includes'](_0x41b4a1[0x2]) && ('RULDFB'['includes'](_0x41b4a1[0x3]) && _0x41b4a1[0x4] == 'w' || 'ruldfb'['includes'](_0x41b4a1[0x3]))) {
            _0x49ef8b = !![];
            _0x125ecf = _0x41b4a1[0x0];
            _0x2da6f6 = _0x41b4a1[0x2];
            _0x41b4a1 = _0x41b4a1['substring'](0x3);
        }
        for (let _0x1d8439 = 0x0; _0x1d8439 < _0x1bf85b['length']; _0x1d8439++) {
            for (let _0x47d5bc = 0x0; _0x47d5bc < _0x59a981['length']; _0x47d5bc++) {
                if (_0x41b4a1 == _0x1bf85b[_0x1d8439] + _0x59a981[_0x47d5bc]) {
                    if (_0x49ef8b) {
                        return _0x125ecf + '-' + _0x2da6f6 + _0x33d6a0[_0x1d8439] + _0x200120[_0x47d5bc];
                    } else if (_0x1bf85b[_0x1d8439] == 'S' || _0x1bf85b[_0x1d8439] == 'y') {
                        return _0x33d6a0[_0x1d8439] + _0x58513f[_0x47d5bc];
                    }
                    return _0x33d6a0[_0x1d8439] + _0x200120[_0x47d5bc];
                }
            }
        }
        return null;
    }
    static ['RotateMovesY'](_0x518527) {
        let _0xca9d86 = '';
        if (_0x518527 == null || _0x518527['length'] == 0x0) {
            return '';
        }
        let _0x33b2c1 = !![];
        let _0x4f604a = NxN_AlgHandler['getAllMoves'](_0x518527);
        for (const _0x41613c of _0x4f604a) {
            let _0x42d5e2 = _0x41613c['move'];
            if (_0x42d5e2[0x0] == '/' || _0x42d5e2 == '\x0a') {
                _0xca9d86 += _0x42d5e2;
                continue;
            }
            let _0x5262a9 = NxN_AlgHandler['moveToFormal'](_0x42d5e2, this['rank']);
            if (_0x5262a9 == ![]) {
                continue;
            }
            if (_0x33b2c1) {
                const _0x5a78d4 = {
                    'y': 'y2\x20',
                    'y2': 'y\x27\x20',
                    'y\x27': '\x20'
                };
                _0x33b2c1 = ![];
                if (_0x5a78d4['hasOwnProperty'](_0x42d5e2)) {
                    _0xca9d86 += _0x5a78d4[_0x42d5e2];
                } else
                    _0xca9d86 += 'y\x20' + this['RotateMoveY'](_0x42d5e2) + '\x20';
            } else {
                _0xca9d86 += this['RotateMoveY'](_0x42d5e2) + '\x20';
            }
        }
        return _0xca9d86;
    }
    static ['RotateMoveY'](_0x1fb309) {
        if (_0x1fb309 == undefined || _0x1fb309['length'] == 0x0) {
            return ![];
        }
        if (NxN_AlgHandler['Memes']['includes'](_0x1fb309)) {
            return _0x1fb309;
        }
        _0x1fb309 = _0x1fb309['trim']();
        let _0x585e58 = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            '6Fw',
            '5Fw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '6Rw',
            '5Rw',
            '4Rw',
            '3Rw',
            '2Rw',
            'Rw',
            '6Lw',
            '5Lw',
            '4Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '6Uw',
            '5Uw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '6Dw',
            '5Dw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '6Bw',
            '5Bw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '6r',
            '5r',
            '4r',
            '3r',
            '2r',
            'r',
            '6u',
            '5u',
            '4u',
            '3u',
            '2u',
            'u',
            '6f',
            '5f',
            '4f',
            '3f',
            '2f',
            'f',
            '6l',
            '5l',
            '4l',
            '3l',
            '2l',
            'l',
            '6b',
            '5b',
            '4b',
            '3b',
            '2b',
            'b',
            '6d',
            '5d',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '5R',
            '6R',
            '2L',
            '3L',
            '4L',
            '5L',
            '6L',
            '2D',
            '3D',
            '4D',
            '5D',
            '6D',
            '2B',
            '3B',
            '4B',
            '5B',
            '6B',
            '2F',
            '3F',
            '4F',
            '5F',
            '6F',
            '2U',
            '3U',
            '4U',
            '5U',
            '6U',
            'x',
            'y',
            'z',
            '.'
        ];
        let _0x14dba0 = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x296d1a = [
            '\x27',
            '',
            '2',
            '3\x27',
            '2',
            '3'
        ];
        let _0x5bddc2 = [
            'F',
            'U',
            'B',
            'L',
            'D',
            'R',
            '6Lw',
            '5Lw',
            '4Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '6Fw',
            '5Fw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '6Bw',
            '5Bw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '6Uw',
            '5Uw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '6Dw',
            '5Dw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '6Rw',
            '5Rw',
            '4Rw',
            '3Rw',
            '2Rw',
            'Rw',
            '6f',
            '5f',
            '4f',
            '3f',
            '2f',
            'f',
            '6u',
            '5u',
            '4u',
            '3u',
            '2u',
            'u',
            '6l',
            '5l',
            '4l',
            '3l',
            '2l',
            'l',
            '6b',
            '5b',
            '4b',
            '3b',
            '2b',
            'b',
            '6r',
            '5r',
            '4r',
            '3r',
            '2r',
            'r',
            '6d',
            '5d',
            '4d',
            '3d',
            '2d',
            'd',
            'S',
            'E',
            'M',
            '2F',
            '3F',
            '4F',
            '5F',
            '6F',
            '2B',
            '3B',
            '4B',
            '5B',
            '6B',
            '2D',
            '3D',
            '4D',
            '5D',
            '6D',
            '2R',
            '3R',
            '4R',
            '5R',
            '6R',
            '2L',
            '3L',
            '4L',
            '5L',
            '6L',
            '2U',
            '3U',
            '4U',
            '5U',
            '6U',
            'z',
            'y',
            'x',
            '.'
        ];
        let _0x98ba3c = ![];
        let _0x1bee02 = 0x0;
        let _0x39dd11 = 0x0;
        if ('1234567'['includes'](_0x1fb309[0x0]) && _0x1fb309[0x1] == '-' && '1234567'['includes'](_0x1fb309[0x2]) && ('RULDFB'['includes'](_0x1fb309[0x3]) && _0x1fb309[0x4] == 'w' || 'ruldfb'['includes'](_0x1fb309[0x3]))) {
            _0x98ba3c = !![];
            _0x1bee02 = _0x1fb309[0x0];
            _0x39dd11 = _0x1fb309[0x2];
            _0x1fb309 = _0x1fb309['substring'](0x3);
        }
        for (let _0x5030b7 = 0x0; _0x5030b7 < _0x585e58['length']; _0x5030b7++) {
            for (let _0x1cb1c4 = 0x0; _0x1cb1c4 < _0x14dba0['length']; _0x1cb1c4++) {
                if (_0x1fb309 == _0x585e58[_0x5030b7] + _0x14dba0[_0x1cb1c4]) {
                    if (_0x98ba3c) {
                        return _0x1bee02 + '-' + _0x39dd11 + _0x5bddc2[_0x5030b7] + _0x14dba0[_0x1cb1c4];
                    } else if (_0x585e58[_0x5030b7] == 'M' || _0x585e58[_0x5030b7] == 'z') {
                        return _0x5bddc2[_0x5030b7] + _0x296d1a[_0x1cb1c4];
                    } else
                        return _0x5bddc2[_0x5030b7] + _0x14dba0[_0x1cb1c4];
                }
            }
        }
        return null;
    }
    static ['RotateMovesZ'](_0x58da05) {
        let _0x2b6894 = '';
        if (_0x58da05 == null || _0x58da05['length'] == 0x0) {
            return '';
        }
        let _0x5d0e05 = !![];
        let _0x54aae8 = NxN_AlgHandler['getAllMoves'](_0x58da05);
        for (const _0x23dba5 of _0x54aae8) {
            let _0xb9cee9 = _0x23dba5['move'];
            if (_0xb9cee9[0x0] == '/' || _0xb9cee9 == '\x0a') {
                _0x2b6894 += _0xb9cee9;
                continue;
            }
            let _0x31801f = NxN_AlgHandler['moveToFormal'](_0xb9cee9, this['rank']);
            if (_0x31801f == ![]) {
                continue;
            }
            if (_0x5d0e05) {
                const _0x55c743 = {
                    'z': 'z2\x20',
                    'z2': 'z\x27\x20',
                    'z\x27': '\x20'
                };
                _0x5d0e05 = ![];
                if (_0x55c743['hasOwnProperty'](_0xb9cee9)) {
                    _0x2b6894 += _0x55c743[_0xb9cee9];
                } else
                    _0x2b6894 += 'z\x20' + this['RotateMoveZ'](_0xb9cee9) + '\x20';
            } else {
                _0x2b6894 += this['RotateMoveZ'](_0xb9cee9) + '\x20';
            }
        }
        return _0x2b6894;
    }
    static ['RotateMoveZ'](_0x24d0b1) {
        if (_0x24d0b1 == undefined || _0x24d0b1['length'] == 0x0) {
            return ![];
        }
        if (NxN_AlgHandler['Memes']['includes'](_0x24d0b1)) {
            return _0x24d0b1;
        }
        _0x24d0b1 = _0x24d0b1['trim']();
        let _0x654a80 = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            '6Fw',
            '5Fw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '6Rw',
            '5Rw',
            '4Rw',
            '3Rw',
            '2Rw',
            'Rw',
            '6Lw',
            '5Lw',
            '4Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '6Uw',
            '5Uw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '6Dw',
            '5Dw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '6Bw',
            '5Bw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '6r',
            '5r',
            '4r',
            '3r',
            '2r',
            'r',
            '6u',
            '5u',
            '4u',
            '3u',
            '2u',
            'u',
            '6f',
            '5f',
            '4f',
            '3f',
            '2f',
            'f',
            '6l',
            '5l',
            '4l',
            '3l',
            '2l',
            'l',
            '6b',
            '5b',
            '4b',
            '3b',
            '2b',
            'b',
            '6d',
            '5d',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '5R',
            '6R',
            '2L',
            '3L',
            '4L',
            '5L',
            '6L',
            '2F',
            '3F',
            '4F',
            '5F',
            '6F',
            '2D',
            '3D',
            '4D',
            '5D',
            '6D',
            '2U',
            '3U',
            '4U',
            '5U',
            '6U',
            '2B',
            '3B',
            '4B',
            '5B',
            '6B',
            'x',
            'y',
            'z',
            '.'
        ];
        let _0x4abb6a = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x471149 = [
            '\x27',
            '',
            '2',
            '3\x27',
            '2',
            '3'
        ];
        let _0x1c7829 = [
            'D',
            'R',
            'U',
            'F',
            'L',
            'B',
            '6Fw',
            '5Fw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '6Dw',
            '5Dw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '6Uw',
            '5Uw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '6Rw',
            '5Rw',
            '4Rw',
            '3Rw',
            '2Rw',
            'Rw',
            '6Lw',
            '5Lw',
            '4Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '6Bw',
            '5Bw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '6d',
            '5d',
            '4d',
            '3d',
            '2d',
            'd',
            '6r',
            '5r',
            '4r',
            '3r',
            '2r',
            'r',
            '6f',
            '5f',
            '4f',
            '3f',
            '2f',
            'f',
            '6u',
            '5u',
            '4u',
            '3u',
            '2u',
            'u',
            '6b',
            '5b',
            '4b',
            '3b',
            '2b',
            'b',
            '6l',
            '5l',
            '4l',
            '3l',
            '2l',
            'l',
            'E',
            'M',
            'S',
            '2D',
            '3D',
            '4D',
            '5D',
            '6D',
            '2U',
            '3U',
            '4U',
            '5U',
            '6U',
            '2F',
            '3F',
            '4F',
            '5F',
            '6F',
            '2L',
            '3L',
            '4L',
            '5L',
            '6L',
            '2R',
            '3R',
            '4R',
            '5R',
            '6R',
            '2B',
            '3B',
            '4B',
            '5B',
            '6B',
            'y',
            'x',
            'z',
            '.'
        ];
        let _0xedb304 = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x17b318 = ![];
        let _0x4532e2 = 0x0;
        let _0x5351d2 = 0x0;
        if ('1234567'['includes'](_0x24d0b1[0x0]) && _0x24d0b1[0x1] == '-' && '1234567'['includes'](_0x24d0b1[0x2]) && ('RULDFB'['includes'](_0x24d0b1[0x3]) && _0x24d0b1[0x4] == 'w' || 'ruldfb'['includes'](_0x24d0b1[0x3]))) {
            _0x17b318 = !![];
            _0x4532e2 = _0x24d0b1[0x0];
            _0x5351d2 = _0x24d0b1[0x2];
            _0x24d0b1 = _0x24d0b1['substring'](0x3);
        }
        for (let _0x3ec7d7 = 0x0; _0x3ec7d7 < _0x654a80['length']; _0x3ec7d7++) {
            for (let _0x98a9ba = 0x0; _0x98a9ba < _0x4abb6a['length']; _0x98a9ba++) {
                if (_0x24d0b1 == _0x654a80[_0x3ec7d7] + _0x4abb6a[_0x98a9ba]) {
                    if (_0x17b318) {
                        return _0x4532e2 + '-' + _0x5351d2 + _0x1c7829[_0x3ec7d7] + _0xedb304[_0x98a9ba];
                    } else if (_0x654a80[_0x3ec7d7] == 'M' || _0x654a80[_0x3ec7d7] == 'x') {
                        return _0x1c7829[_0x3ec7d7] + _0x471149[_0x98a9ba];
                    }
                    return _0x1c7829[_0x3ec7d7] + _0xedb304[_0x98a9ba];
                }
            }
        }
        return null;
    }
    static ['MirrorMovesM'](_0x13bdc5) {
        let _0x5b57f0 = _0x13bdc5['match'](/[^\r\n]+/g);
        let _0x71e8a1 = '';
        if (_0x5b57f0 == null || _0x5b57f0['length'] == 0x0) {
            return '';
        }
        for (let _0x260748 = 0x0; _0x260748 < _0x5b57f0['length']; _0x260748++) {
            let _0x55bf10 = NxN_AlgHandler['getAllMoves'](_0x5b57f0[_0x260748]);
            for (const _0x96ad58 of _0x55bf10) {
                let _0x53cacd = _0x96ad58['move'];
                if (_0x53cacd[0x0] == '/') {
                    _0x71e8a1 += _0x53cacd;
                    continue;
                }
                let _0x422694 = NxN_AlgHandler['moveToFormal'](_0x53cacd, this['rank']);
                if (_0x422694 == ![]) {
                    continue;
                }
                _0x71e8a1 += this['MirrorMoveM'](_0x53cacd) + '\x20';
            }
            if (_0x260748 != _0x5b57f0['length'] - 0x1) {
                _0x71e8a1 += '\x0a';
            }
        }
        return _0x71e8a1;
    }
    static ['MirrorMovesS'](_0x11406f) {
        let _0xe5f02b = _0x11406f['match'](/[^\r\n]+/g);
        let _0x132a9c = '';
        if (_0xe5f02b == null || _0xe5f02b['length'] == 0x0) {
            return '';
        }
        for (let _0x2deefc = 0x0; _0x2deefc < _0xe5f02b['length']; _0x2deefc++) {
            let _0x51b6ac = NxN_AlgHandler['getAllMoves'](_0xe5f02b[_0x2deefc]);
            for (const _0xe54ad8 of _0x51b6ac) {
                let _0x1433b6 = _0xe54ad8['move'];
                if (_0xe54ad8['move'][0x0] == '/') {
                    _0x132a9c += _0x1433b6;
                    continue;
                }
                let _0x16c916 = NxN_AlgHandler['moveToFormal'](_0x1433b6, this['rank']);
                if (_0x16c916 == ![]) {
                    continue;
                }
                _0x132a9c += this['MirrorMoveS'](_0x1433b6) + '\x20';
            }
            if (_0x2deefc != _0xe5f02b['length'] - 0x1) {
                _0x132a9c += '\x0a';
            }
        }
        return _0x132a9c;
    }
    static ['MirrorMoveS'](_0x183be4) {
        if (_0x183be4 == undefined || _0x183be4['length'] == 0x0) {
            return ![];
        }
        if (NxN_AlgHandler['Memes']['includes'](_0x183be4)) {
            return _0x183be4;
        }
        _0x183be4 = _0x183be4['trim']();
        let _0x35007a = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '2Rw',
            '3Rw',
            'Rw',
            'Rw',
            '2Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '4r',
            '3r',
            '2r',
            'r',
            '4u',
            '3u',
            '2u',
            'u',
            '4f',
            '3f',
            '2f',
            'f',
            '4l',
            '3l',
            '2l',
            'l',
            '4b',
            '3b',
            '2b',
            'b',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '2L',
            '3L',
            '4L',
            '2D',
            '3D',
            '4D',
            '2B',
            '3B',
            '4B',
            '2F',
            '3F',
            '4F',
            '2U',
            '3U',
            '4U',
            'x',
            'y',
            'z'
        ];
        let _0x3a0715 = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x3f6c7b = [
            'R',
            'U',
            'L',
            'B',
            'D',
            'F',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '2Rw',
            '3Rw',
            'Rw',
            'Rw',
            '2Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '4r',
            '3r',
            '2r',
            'r',
            '4u',
            '3u',
            '2u',
            'u',
            '4b',
            '3b',
            '2b',
            'b',
            '4l',
            '3l',
            '2l',
            'l',
            '4f',
            '3f',
            '2f',
            'f',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '2L',
            '3L',
            '4L',
            '2D',
            '3D',
            '4D',
            '2F',
            '3F',
            '4F',
            '2B',
            '3B',
            '4B',
            '2U',
            '3U',
            '4U',
            'x',
            'y',
            'z'
        ];
        let _0x450c7c = [
            '\x27',
            '',
            '2\x27',
            '3\x27',
            '2',
            '3'
        ];
        let _0xa9295b = '';
        let _0x33ac32 = '';
        let _0xf69f56 = '';
        let _0x20eb89 = '';
        for (let _0x159b98 = 0x0; _0x159b98 < _0x35007a['length']; _0x159b98++) {
            for (let _0x582315 = 0x0; _0x582315 < _0x3a0715['length']; _0x582315++) {
                if (_0x183be4 == _0x35007a[_0x159b98] + _0x3a0715[_0x582315]) {
                    if (_0x35007a[_0x159b98] == 'z') {
                        return _0x183be4;
                    }
                    return _0x3f6c7b[_0x159b98] + _0x450c7c[_0x582315];
                    break;
                }
            }
        }
        return null;
    }
    static ['InvertMove'](_0x17d68a) {
        if (_0x17d68a == undefined || _0x17d68a['length'] == 0x0) {
            return ![];
        }
        _0x17d68a = _0x17d68a['trim']();
        if (NxN_AlgHandler['Memes']['includes'](_0x17d68a)) {
            return _0x17d68a;
        }
        let _0x531477 = ![];
        let _0x1ff2dd = 0x0;
        let _0x138811 = 0x0;
        if ('1234567'['includes'](_0x17d68a[0x0]) && _0x17d68a[0x1] == '-' && '1234567'['includes'](_0x17d68a[0x2]) && ('RULDFB'['includes'](_0x17d68a[0x3]) && _0x17d68a[0x4] == 'w' || 'ruldfb'['includes'](_0x17d68a[0x3]))) {
            _0x531477 = !![];
            _0x1ff2dd = _0x17d68a[0x0];
            _0x138811 = _0x17d68a[0x2];
            _0x17d68a = _0x17d68a['substring'](0x3);
        }
        let _0x2dab3c = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '2Rw',
            '3Rw',
            'Rw',
            'Rw',
            '2Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '4r',
            '3r',
            '2r',
            'r',
            '4u',
            '3u',
            '2u',
            'u',
            '4f',
            '3f',
            '2f',
            'f',
            '4l',
            '3l',
            '2l',
            'l',
            '4b',
            '3b',
            '2b',
            'b',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '2L',
            '3L',
            '4L',
            '2D',
            '3D',
            '4D',
            '2B',
            '3B',
            '4B',
            '2F',
            '3F',
            '4F',
            '2U',
            '3U',
            '4U',
            'x',
            'y',
            'z'
        ];
        let _0xafa9ab = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x2572a7 = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '2Rw',
            '3Rw',
            'Rw',
            'Rw',
            '2Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '4r',
            '3r',
            '2r',
            'r',
            '4u',
            '3u',
            '2u',
            'u',
            '4f',
            '3f',
            '2f',
            'f',
            '4l',
            '3l',
            '2l',
            'l',
            '4b',
            '3b',
            '2b',
            'b',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '2L',
            '3L',
            '4L',
            '2D',
            '3D',
            '4D',
            '2B',
            '3B',
            '4B',
            '2F',
            '3F',
            '4F',
            '2U',
            '3U',
            '4U',
            'x',
            'y',
            'z'
        ];
        let _0x347e9e = [
            '\x27',
            '',
            '2\x27',
            '3\x27',
            '2',
            '3'
        ];
        for (let _0x2d68fa = 0x0; _0x2d68fa < _0x2dab3c['length']; _0x2d68fa++) {
            for (let _0x556e63 = 0x0; _0x556e63 < _0xafa9ab['length']; _0x556e63++) {
                if (_0x17d68a == _0x2dab3c[_0x2d68fa] + _0xafa9ab[_0x556e63]) {
                    if (_0x531477) {
                        return _0x1ff2dd + '-' + _0x138811 + _0x2572a7[_0x2d68fa] + _0x347e9e[_0x556e63];
                    } else {
                        return _0x2572a7[_0x2d68fa] + _0x347e9e[_0x556e63];
                    }
                }
            }
        }
        return null;
    }
    static ['InvertMoves'](_0x37ffd4) {
        let _0x26306a = _0x37ffd4['match'](/[^\r\n]+/g);
        let _0x167733 = '';
        let _0xdcf8ef = '';
        if (_0x26306a == null || _0x26306a['length'] == 0x0) {
            return '';
        }
        for (let _0x452ab3 = 0x0; _0x452ab3 < _0x26306a['length']; _0x452ab3++) {
            _0xdcf8ef = '';
            let _0x1dd92a = NxN_AlgHandler['getAllMoves'](_0x26306a[_0x452ab3]);
            for (const _0xd8e577 of _0x1dd92a) {
                let _0x3d9804 = _0xd8e577['move'];
                if (_0xd8e577['move'][0x0] == '/') {
                    _0xdcf8ef += _0x3d9804;
                    continue;
                }
                let _0x2899ee = NxN_AlgHandler['moveToFormal'](_0x3d9804, this['rank']);
                if (_0x2899ee == ![]) {
                    continue;
                }
                if (_0xdcf8ef['length'] == 0x0) {
                    _0xdcf8ef = this['InvertMove'](_0x3d9804);
                } else {
                    _0xdcf8ef = this['InvertMove'](_0x3d9804) + '\x20' + _0xdcf8ef;
                }
            }
            if (_0x452ab3 > 0x0) {
                _0x167733 = _0xdcf8ef + '\x0a' + _0x167733;
            } else {
                _0x167733 = _0xdcf8ef;
            }
        }
        return _0x167733;
    }
    static ['MirrorMoveM'](_0x8baae4) {
        if (_0x8baae4 == undefined || _0x8baae4['length'] == 0x0) {
            return ![];
        }
        _0x8baae4 = _0x8baae4['trim']();
        if (NxN_AlgHandler['Memes']['includes'](_0x8baae4)) {
            return _0x8baae4;
        }
        let _0x521086 = ![];
        let _0x530398 = 0x0;
        let _0xcc2b5a = 0x0;
        if ('1234567'['includes'](_0x8baae4[0x0]) && _0x8baae4[0x1] == '-' && '1234567'['includes'](_0x8baae4[0x2]) && ('RULDFB'['includes'](_0x8baae4[0x3]) && _0x8baae4[0x4] == 'w' || 'ruldfb'['includes'](_0x8baae4[0x3]))) {
            _0x521086 = !![];
            _0x530398 = _0x8baae4[0x0];
            _0xcc2b5a = _0x8baae4[0x2];
            _0x8baae4 = _0x8baae4['substring'](0x3);
        }
        let _0x1f012c = [
            'R',
            'U',
            'L',
            'F',
            'D',
            'B',
            'M',
            'E',
            'S',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '2Rw',
            '3Rw',
            'Rw',
            'Rw',
            '2Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '4r',
            '3r',
            '2r',
            'r',
            '4u',
            '3u',
            '2u',
            'u',
            '4f',
            '3f',
            '2f',
            'f',
            '4l',
            '3l',
            '2l',
            'l',
            '4b',
            '3b',
            '2b',
            'b',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2R',
            '3R',
            '4R',
            '2L',
            '3L',
            '4L',
            '2D',
            '3D',
            '4D',
            '2B',
            '3B',
            '4B',
            '2F',
            '3F',
            '4F',
            '2U',
            '3U',
            '4U',
            'x',
            'y',
            'z'
        ];
        let _0x72d681 = [
            '',
            '\x27',
            '2',
            '3',
            '2\x27',
            '3\x27'
        ];
        let _0x3bd0d6 = [
            'L',
            'U',
            'R',
            'F',
            'D',
            'B',
            'M',
            'E',
            'S',
            '4Fw',
            '3Fw',
            '2Fw',
            'Fw',
            '2Lw',
            '3Lw',
            '2Lw',
            'Lw',
            '2Rw',
            '3Rw',
            'Rw',
            'Rw',
            '4Uw',
            '3Uw',
            '2Uw',
            'Uw',
            '4Dw',
            '3Dw',
            '2Dw',
            'Dw',
            '4Bw',
            '3Bw',
            '2Bw',
            'Bw',
            '4l',
            '3l',
            '2l',
            'l',
            '4u',
            '3u',
            '2u',
            'u',
            '4f',
            '3f',
            '2f',
            'f',
            '4r',
            '3r',
            '2r',
            'r',
            '4b',
            '3b',
            '2b',
            'b',
            '4d',
            '3d',
            '2d',
            'd',
            'M',
            'E',
            'S',
            '2L',
            '3L',
            '4L',
            '2R',
            '3R',
            '4R',
            '2D',
            '3D',
            '4D',
            '2B',
            '3B',
            '4B',
            '2F',
            '3F',
            '4F',
            '2U',
            '3U',
            '4U',
            'x',
            'y',
            'z'
        ];
        let _0x17d77f = [
            '\x27',
            '',
            '2\x27',
            '3\x27',
            '2',
            '3'
        ];
        let _0x56c95b = '';
        let _0x3f6700 = '';
        let _0x3e019f = '';
        let _0x5d0255 = '';
        for (let _0x1295ee = 0x0; _0x1295ee < _0x1f012c['length']; _0x1295ee++) {
            for (let _0x33efbc = 0x0; _0x33efbc < _0x72d681['length']; _0x33efbc++) {
                if (_0x8baae4 == _0x1f012c[_0x1295ee] + _0x72d681[_0x33efbc]) {
                    if (_0x521086) {
                        return _0x530398 + '-' + _0xcc2b5a + _0x3bd0d6[_0x1295ee] + _0x17d77f[_0x33efbc];
                    } else if (_0x1f012c[_0x1295ee] == 'x' || _0x1f012c[_0x1295ee] == 'M') {
                        return _0x8baae4;
                    }
                    return _0x3bd0d6[_0x1295ee] + _0x17d77f[_0x33efbc];
                }
            }
        }
        return null;
    }
}
NxN['movesRegex'] = /(\/.*|\)\d+|\{\d+\}|[\[\]\(\)\:\,]|[1234567]\-[1234567][RULFBD]w[23]?\'?|[1234567]\-[1234567][rulfbd][23]?\'?|[23456]?[RULFBD]w[23]?\'?|[23456]?[RULFBDrulfbd][23]?\'?|[xyz][23]?'?|[MES][23]?'?|\.|\n)/g;
NxN_AlgHandler['Memes'] = [
    'FaZ',
    'Cat'
];
NxN_AlgHandler['CMLLDictionary'] = {
    'O\x20Adjacent': [
        'R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27',
        'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
        'R\x20U\x27\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20U2\x27\x20R\x27'
    ],
    'O\x20Diagonal': [
        'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27',
        'F\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
    ],
    'H\x20Columns': [
        'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
        'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27'
    ],
    'H\x20Rows': [
        'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27'
    ],
    'H\x20Column': [
        'R\x27\x20F2\x20D\x20R2\x20U\x20R2\x27\x20D\x27\x20F2\x20R',
        'U\x20F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'U\x20R\x20U2\x27\x20R2\x27\x20F\x20R\x20F\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27'
    ],
    'H\x20Row': [
        'U2\x20r\x20U\x27\x20r2\x27\x20D\x27\x20r\x20U\x27\x20r\x27\x20D\x20r2\x20U\x20r\x27',
        'U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20r\x27\x20F\x20R\x27\x20F\x27\x20r'
    ],
    'Pi\x20Right\x20Bar': [
        'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'U2\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27'
    ],
    'Pi\x20Down\x20Slash': [
        'U\x20F\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x27\x20R\x27',
        'U\x20F\x20U\x20R\x20U\x27\x20R2\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x27\x20R\x27'
    ],
    'Pi\x20X': [
        'R\x27\x20F2\x20D\x20R2\x20U\x27\x20R2\x27\x20D\x27\x20F2\x20R',
        'U\x27\x20R\x27\x20F\x20R\x20U\x20F\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
    ],
    'Pi\x20Up\x20Slash': ['R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R\x27\x20F\x20R\x20F\x27'],
    'Pi\x20Columns': [
        'U\x27\x20r\x20U\x27\x20r2\x27\x20D\x27\x20r\x20U\x20r\x27\x20D\x20r2\x20U\x20r\x27',
        'U2\x20R\x27\x20F\x20R\x20F\x27\x20r\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20r\x27\x20'
    ],
    'Pi\x20Left\x20Bar': [
        'U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
        'R\x27\x20F\x27\x20U\x27\x20F\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
        'U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20B\x20U\x27\x20B\x27\x20R\x27',
        'U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20F\x27\x20U\x20F\x20R'
    ],
    'U\x20Up\x20Slash': ['U2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27'],
    'U\x20Down\x20Slash': ['R2\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R'],
    'U\x20Bottom\x20Row': [
        'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x27\x20R2\x20U\x20R\x27\x20U\x20R\x20U2\x27\x20R\x27',
        'U2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x27\x20R2\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
        'R2\x27\x20F\x20U\x27\x20F\x20U\x20F2\x20R2\x20U\x27\x20R\x27\x20F\x20R'
    ],
    'U\x20Rows': [
        'U\x27\x20F\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x27\x20U\x27\x20F\x27',
        'U2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20F\x27\x20U\x20R\x27\x20U\x27\x20R'
    ],
    'U\x20X': [
        'U2\x20r\x20U\x27\x20r\x27\x20U\x20r\x27\x20D\x27\x20r\x20U\x27\x20r\x27\x20D\x20r',
        'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27'
    ],
    'U\x20Upper\x20Row': [
        'U\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'U\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27'
    ],
    'T\x20Left\x20Bar': [
        'U\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
        'U\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27'
    ],
    'T\x20Right\x20Bar': [
        'U\x20l\x27\x20U\x27\x20L\x20U\x20l\x20F\x27\x20L\x27\x20F',
        'U\x20r\x27\x20F\x27\x20r\x20U\x20r\x20U\x27\x20r\x27\x20F'
    ],
    'T\x20Rows': [
        'F\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2',
        'R\x20U2\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x20R'
    ],
    'T\x20Bottom\x20Row': [
        'r\x27\x20U\x20r\x20U2\x27\x20R2\x27\x20F\x20R\x20F\x27\x20R',
        'R\x20U\x20R2\x27\x20F\x20R\x20F\x27\x20U\x20r\x20U\x20r\x27'
    ],
    'T\x20Top\x20Row': ['r\x27\x20D\x27\x20r\x20U\x20r\x27\x20D\x20r\x20U\x27\x20r\x20U\x20r\x27'],
    'T\x20Columns': [
        'U2\x20r\x20U\x27\x20r2\x27\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20r2\x20U\x20r\x27',
        'R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x27\x20U\x27\x20R'
    ],
    'Sune\x20Left\x20Bar': [
        'U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
        'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R'
    ],
    'Sune\x20X': [
        'U\x20L\x27\x20U2\x20L\x20U2\x27\x20r\x20U\x27\x20r\x27\x20F',
        'U\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
        'U\x20L\x27\x20U2\x20L\x20U2\x27\x20L\x20F\x27\x20L\x27\x20F'
    ],
    'Sune\x20Up\x20Slash': ['U\x20F\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x27\x20R\x27'],
    'Sune\x20Columns': [
        'U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x27\x20R\x27',
        'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x27',
        'U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20F\x20R\x20F\x27\x20r\x20U\x20r\x27'
    ],
    'Sune\x20Right\x20Bar': ['U\x27\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U2\x27\x20R\x27'],
    'Sune\x20Down\x20Slash': [
        'U\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
        'U\x20R\x20U\x27\x20r\x27\x20F\x20R\x27\x20F\x27\x20r'
    ],
    'Anti\x20Sune\x20Right\x20Bar': [
        'U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x27\x20R',
        'U\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U2\x20L',
        'U2\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27'
    ],
    'Anti\x20Sune\x20Columns': [
        'U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
        'U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2'
    ],
    'Anti\x20Sune\x20Down\x20Slash': [
        'U\x27\x20F\x27\x20L\x20F\x20L\x27\x20U2\x27\x20L\x27\x20U2\x20L',
        'U\x27\x20F\x27\x20r\x20U\x20r\x27\x20U2\x27\x20r\x27\x20F2\x20r',
        'U2\x20F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27'
    ],
    'Anti\x20Sune\x20X': ['U\x27\x20R\x20U2\x27\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27'],
    'Anti\x20Sune\x20Up\x20Slash': [
        'U\x27\x20R\x27\x20F\x20R\x20F\x27\x20r\x20U\x20r\x27',
        'U\x27\x20r\x27\x20F\x20R\x20F\x27\x20r\x20U\x20R\x27',
        'U\x27\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x20R\x27'
    ],
    'Anti\x20Sune\x20Left\x20Bar': [
        'U\x20R\x20U2\x27\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27',
        'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R'
    ],
    'L\x20Best': [
        'U\x27\x20F\x27\x20r\x20U\x20r\x27\x20U\x27\x20r\x27\x20F\x20r',
        'U2\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
        'R2\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R'
    ],
    'L\x20Good': ['U2\x20F\x20R\x27\x20F\x27\x20r\x20U\x20R\x20U\x27\x20r\x27'],
    'L\x20Pure': [
        'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
        'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
        'U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x27\x20R'
    ],
    'L\x20Front\x20Commutator': [
        'U2\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x27',
        'R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27',
        'U\x27\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20U2\x27\x20R\x27\x20U2\x20R'
    ],
    'L\x20Diagonal': [
        'U2\x20R\x20U2\x27\x20R2\x27\x20F\x20R\x20F\x27\x20R\x20U2\x27\x20R\x27',
        'R\x27\x20U\x27\x20R\x20U\x27\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
        'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2'
    ],
    'L\x20Back\x20Commutator': [
        'U\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
        'U\x27\x20R\x27\x20F2\x20R\x27\x20U\x27\x20R\x20F2\x20R\x27\x20U\x20R2'
    ]
};
NxN_AlgHandler['PLLDictionary'] = {
    'Aa': ['x\x20R\x27\x20U\x20R\x27\x20D2\x20R\x20U\x27\x20R\x27\x20D2\x20R2\x20x\x27'],
    'Ab': ['x\x20R2\x20D2\x20R\x20U\x20R\x27\x20D2\x20R\x20U\x27\x20R\x20x\x27'],
    'E': ['y\x20x\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x27\x20R\x27\x20D\x27x'],
    'F': ['y\x20R2\x27\x20F\x20R\x20F\x27\x20R\x27\x20U\x27\x20F\x27\x20U\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20R'],
    'Ga': ['R2\x20u\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20u\x27\x20R2\x20F\x27\x20U\x20F'],
    'Gb': ['y\x20F\x27\x20U\x27\x20F\x20R2\x20u\x20R\x27\x20U\x20R\x20U\x27\x20R\x20u\x27\x20R2'],
    'Gc': ['R2\x27\x20u\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20u\x20R2\x20f\x20R\x27\x20f\x27'],
    'Gd': ['R\x20U\x20R\x27\x20y\x27\x20R2\x20u\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20u\x20R2'],
    'H': ['M2\x27\x20U\x27\x20M2\x27\x20U2\x20M2\x27\x20U\x27\x20M2\x27'],
    'Ja': ['y\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20L'],
    'Jb': ['R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27'],
    'Na': ['F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20R\x27'],
    'Nb': ['r\x27\x20D\x27\x20F\x20r\x20U\x27\x20r\x27\x20F\x27\x20D\x20r2\x20U\x20r\x27\x20U\x27\x20r\x27\x20F\x20r\x20F\x27'],
    'Ra': ['y\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27'],
    'Rb': ['R\x27\x20U2\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R2'],
    'T': ['R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27'],
    'Ua': ['M2\x27\x20U\x20M\x27\x20U2\x20M\x20U\x20M2\x27'],
    'Ub': ['M2\x27\x20U\x27\x20M\x27\x20U2\x20M\x20U\x27\x20M2\x27'],
    'V': ['R\x27\x20U\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20D\x20R\x27\x20U\x20D\x27\x20R2\x20U\x27\x20R2\x27\x20D\x20R2'],
    'Y': ['F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27'],
    'Z': ['y\x20M2\x27\x20U\x27\x20M2\x20U\x27\x20M\x27\x20U2\x20M2\x20U2\x20M\x27']
};
NxN_AlgHandler['PLLRot'] = {
    'Aa': 0x4,
    'Ab': 0x4,
    'E': 0x2,
    'F': 0x4,
    'Ga': 0x4,
    'Gb': 0x4,
    'Gc': 0x4,
    'Gd': 0x4,
    'H': 0x1,
    'Ja': 0x4,
    'Jb': 0x4,
    'Na': 0x1,
    'Nb': 0x1,
    'Ra': 0x4,
    'Rb': 0x4,
    'T': 0x4,
    'Ua': 0x4,
    'Ub': 0x4,
    'V': 0x4,
    'Y': 0x4,
    'Z': 0x2
};
NxN_AlgHandler['OLLDictionary'] = {
    'OLL\x201': [
        'R\x20U2\x20R2\x20F\x20R\x20F\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27',
        'R\x20U\x27\x20R2\x20D\x27\x20r\x20U\x27\x20r\x27\x20D\x20R2\x20U\x20R\x27'
    ],
    'OLL\x202': [
        'F\x20R\x20U\x20R\x27\x20U\x27\x20S\x20R\x20U\x20R\x27\x20U\x27\x20f\x27',
        'y\x27\x20R\x20U\x27\x20R2\x27\x20D\x27\x20r\x20U\x20r\x27\x20D\x20R2\x20U\x20R\x27',
        'y\x20r\x20U\x20r\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20r\x20U\x27\x20r\x27'
    ],
    'OLL\x203': [
        'y\x20R\x27\x20F2\x20R2\x20U2\x20R\x27\x20F\x20R\x20U2\x20R2\x20F2\x20R',
        'r\x27\x20R2\x20U\x20R\x27\x20U\x20r\x20U2\x20r\x27\x20U\x20M\x27',
        'y\x27\x20f\x20R\x20U\x20R\x27\x20U\x27\x20f\x27\x20U\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20U\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
    ],
    'OLL\x204': [
        'y\x27\x20R\x27\x20F2\x20R2\x20U2\x20R\x27\x20F\x27\x20R\x20U2\x20R2\x20F2\x20R',
        'y\x27\x20f\x20R\x20U\x20R\x27\x20U\x27\x20f\x27\x20U\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'y2\x20M\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20r\x27\x20U2\x20r\x20U\x27\x20M'
    ],
    'OLL\x205': ['r\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20r'],
    'OLL\x206': ['r\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20r\x27'],
    'OLL\x207': ['r\x20U\x20R\x27\x20U\x20R\x20U2\x20r\x27'],
    'OLL\x208': [
        'y2\x20r\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20r',
        'R\x27\x20F\x27\x20r\x20U\x27\x20r\x27\x20F2\x20R',
        'R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27'
    ],
    'OLL\x209': ['y\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20F\x27'],
    'OLL\x2010': ['R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U2\x20R\x27'],
    'OLL\x2011': [
        'r\x27\x20R2\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20M\x27',
        'M\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20M\x27'
    ],
    'OLL\x2012': [
        'y\x27\x20M\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20M',
        'F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20U\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
    ],
    'OLL\x2013': [
        'F\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
        'r\x20U\x27\x20r\x27\x20U\x27\x20r\x20U\x20r\x27\x20F\x27\x20U\x20F',
        'F\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27'
    ],
    'OLL\x2014': [
        'R\x27\x20F\x20R\x20U\x20R\x27\x20F\x27\x20R\x20F\x20U\x27\x20F\x27',
        'l\x27\x20U\x20l\x20U\x20l\x27\x20U\x27\x20l\x20F\x20U\x27\x20F\x27'
    ],
    'OLL\x2015': [
        'y2\x20l\x27\x20U\x27\x20l\x20L\x27\x20U\x27\x20L\x20U\x20l\x27\x20U\x20l',
        'r\x27\x20U\x27\x20r\x20R\x27\x20U\x27\x20R\x20U\x20r\x27\x20U\x20r',
        '\x20y2\x20R\x27\x20F\x27\x20R\x20L\x27\x20U\x27\x20L\x20U\x20R\x27\x20F\x20R'
    ],
    'OLL\x2016': ['r\x20U\x20r\x27\x20R\x20U\x20R\x27\x20U\x27\x20r\x20U\x27\x20r\x27'],
    'OLL\x2017': [
        'R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27',
        'y2\x20F\x20R\x27\x20F\x27\x20R\x20U\x20S\x27\x20R\x20U\x27\x20R\x27\x20S'
    ],
    'OLL\x2018': [
        'y\x20R\x20U2\x20R2\x20F\x20R\x20F\x27\x20U2\x20M\x27\x20U\x20R\x20U\x27\x20r\x27',
        'R\x20D\x20r\x27\x20U\x27\x20r\x20D\x27\x20R\x27\x20U\x27\x20R2\x20F\x20R\x20F\x27\x20R',
        'y\x27\x20r\x27\x20U\x27\x20R\x20U\x20M\x27\x20U\x27\x20R2\x20F\x20R\x20F\x27\x20U\x20R'
    ],
    'OLL\x2019': [
        'M\x20U\x20R\x20U\x20R\x27\x20U\x27\x20M\x27\x20R\x27\x20F\x20R\x20F\x27',
        'y\x20S\x27\x20R\x20U\x20R\x27\x20S\x20U\x27\x20R\x27\x20F\x20R\x20F\x27'
    ],
    'OLL\x2020': [
        'r\x20U\x20R\x27\x20U\x27\x20M2\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20M\x27',
        'S\x27\x20R\x20U\x20R\x27\x20S\x20U\x27\x20M\x27\x20U\x20R\x20U\x27\x20r\x27'
    ],
    'OLL\x2021': [
        'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
        'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
    ],
    'OLL\x2022': [
        'R\x20U2\x20R2\x27\x20U\x27\x20R2\x20U\x27\x20R2\x27\x20U2\x27\x20R',
        'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L'
    ],
    'OLL\x2023': [
        'R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
        'y2\x20R2\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R'
    ],
    'OLL\x2024': [
        'r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
        'y2\x20l\x27\x20U\x27\x20L\x20U\x20R\x20U\x27\x20r\x27\x20F'
    ],
    'OLL\x2025': [
        'y\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R',
        'F\x20R\x27\x20F\x27\x20r\x20U\x20R\x20U\x27\x20r\x27'
    ],
    'OLL\x2026': [
        'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
        'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R'
    ],
    'OLL\x2027': [
        'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
        'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R'
    ],
    'OLL\x2028': [
        'r\x20U\x20R\x27\x20U\x27\x20M\x20U\x20R\x20U\x27\x20R\x27',
        'y2\x20M\x27\x20U\x20M\x20U2\x20M\x27\x20U\x20M'
    ],
    'OLL\x2029': [
        'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20F\x20R\x20U\x20R\x27',
        'r2\x20D\x27\x20r\x20U\x20r\x27\x20D\x20r2\x20U\x27\x20r\x27\x20U\x27\x20r'
    ],
    'OLL\x2030': [
        'y2\x20F\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2',
        'y\x27\x20r\x27\x20D\x27\x20r\x20U\x27\x20r\x27\x20D\x20r2\x20U\x27\x20r\x27\x20U\x20r\x20U\x20r\x27',
        'y2\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27'
    ],
    'OLL\x2031': [
        'R\x27\x20U\x27\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R',
        'y\x20S\x20R\x20U\x20R\x27\x20U\x27\x20f\x27\x20U\x27\x20F'
    ],
    'OLL\x2032': [
        'S\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20f\x27',
        'R\x20U\x20B\x27\x20U\x27\x20R\x27\x20U\x20R\x20B\x20R\x27'
    ],
    'OLL\x2033': ['R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27'],
    'OLL\x2034': [
        'y2\x20R\x20U\x20R2\x20U\x27\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20F\x27',
        'y\x20f\x20R\x20f\x27\x20U\x27\x20r\x27\x20U\x27\x20R\x20U\x20M\x27'
    ],
    'OLL\x2035': ['R\x20U2\x20R2\x20F\x20R\x20F\x27\x20R\x20U2\x20R\x27'],
    'OLL\x2036': [
        'y2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x20F\x27\x20L\x27\x20F',
        'y\x20R\x20U\x20R2\x20F\x27\x20U\x27\x20F\x20U\x20R2\x20U2\x20R\x27'
    ],
    'OLL\x2037': [
        'F\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27',
        'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27'
    ],
    'OLL\x2038': ['R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27'],
    'OLL\x2039': [
        'y\x20L\x20F\x27\x20L\x27\x20U\x27\x20L\x20U\x20F\x20U\x27\x20L\x27',
        'y\x27\x20R\x20U\x20R\x27\x20F\x27\x20U\x27\x20F\x20U\x20R\x20U2\x20R\x27'
    ],
    'OLL\x2040': ['y\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20U\x20R'],
    'OLL\x2041': [
        'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
        'y2\x20F\x20U\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20F\x27'
    ],
    'OLL\x2042': ['R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'],
    'OLL\x2043': [
        'y\x20R\x27\x20U\x27\x20F\x27\x20U\x20F\x20R',
        'y2\x20F\x27\x20U\x27\x20L\x27\x20U\x20L\x20F',
        'f\x27\x20L\x27\x20U\x27\x20L\x20U\x20f'
    ],
    'OLL\x2044': [
        'y2\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
        'f\x20R\x20U\x20R\x27\x20U\x27\x20f\x27'
    ],
    'OLL\x2045': ['F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'],
    'OLL\x2046': ['R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R'],
    'OLL\x2047': [
        'F\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20F',
        'R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R'
    ],
    'OLL\x2048': ['F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'],
    'OLL\x2049': [
        'y2\x20r\x20U\x27\x20r2\x20U\x20r2\x20U\x20r2\x20U\x27\x20r',
        'l\x20U\x27\x20l2\x20U\x20l2\x20U\x20l2\x20U\x27\x20l'
    ],
    'OLL\x2050': [
        'r\x27\x20U\x20r2\x20U\x27\x20r2\x20U\x27\x20r2\x20U\x20r\x27',
        'y2\x20l\x27\x20U\x20l2\x20U\x27\x20l2\x20U\x27\x20l2\x20U\x20l\x27'
    ],
    'OLL\x2051': [
        'y2\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
        'f\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20f\x27'
    ],
    'OLL\x2052': [
        'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20B\x20U\x27\x20B\x27\x20R\x27',
        'y2\x20R\x27\x20F\x27\x20U\x27\x20F\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R'
    ],
    'OLL\x2053': ['y\x20r\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20r'],
    'OLL\x2054': [
        'r\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20r\x27',
        'y\x27\x20r\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20r\x27'
    ],
    'OLL\x2055': [
        'y\x20R\x27\x20F\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R2\x20U\x20R\x27\x20U\x27\x20R',
        'y\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27'
    ],
    'OLL\x2056': [
        'r\x20U\x20r\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20r\x20U\x27\x20r\x27',
        'r\x20U\x20r\x27\x20U\x20R\x20U\x27\x20R\x27\x20M\x27\x20U\x20R\x20U2\x20r\x27'
    ],
    'OLL\x2057': [
        'R\x20U\x20R\x27\x20U\x27\x20M\x27\x20U\x20R\x20U\x27\x20r\x27',
        'R\x20U\x20R\x27\x20U\x27\x20r\x20R\x27\x20U\x20R\x20U\x27\x20r\x27'
    ]
};
NxN_AlgHandler['ZBLLDictionary'] = {
    'ZBLL\x20AS\x201': 'y\x27\x20R\x20U\x20R\x27\x20B\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20B\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20AS\x202': 'R\x20U2\x20R2\x20F2\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20F2\x20U\x20R',
    'ZBLL\x20AS\x203': 'R\x27\x20U\x27\x20R\x20U\x20R2\x20U\x20L\x20U\x27\x20R2\x20U\x20L\x27\x20U\x20R\x27\x20U2\x20R',
    'ZBLL\x20AS\x204': 'F2\x20R2\x20u\x27\x20L\x20F2\x20L\x27\x20u\x20R2\x20F\x20U2\x20F',
    'ZBLL\x20AS\x205': 'y2\x20R\x27\x20F\x20U2\x20F\x27\x20R\x20F\x20R\x27\x20U2\x20R\x20F\x27',
    'ZBLL\x20AS\x206': 'R\x27\x20U\x20L\x20U\x27\x20R2\x20z\x27\x20R2\x20U\x27\x20L\x20U\x20R2\x20U\x27\x20D\x27\x20z',
    'ZBLL\x20AS\x207': 'y\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x27\x20U2\x20R\x27\x20U2\x20R2\x20U2\x20R\x20U2\x20F\x20R2\x20F\x27',
    'ZBLL\x20AS\x208': 'y\x20R\x20U\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x20L\x20U2\x20R\x27\x20U\x20L\x27\x20U\x20L',
    'ZBLL\x20AS\x209': 'y\x20R\x20U\x20R\x27\x20U2\x20L\x27\x20U2\x20R\x20U2\x20L\x20U\x20L\x27\x20R\x27\x20U2\x20L',
    'ZBLL\x20AS\x2010': 'y\x20R\x27\x20U\x20L\x20U\x27\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x20L\x20U\x27\x20R\x20U2\x20L\x27',
    'ZBLL\x20AS\x2011': 'y2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2012': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2',
    'ZBLL\x20AS\x2013': 'R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R',
    'ZBLL\x20AS\x2014': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2015': 'y2\x20R\x20U2\x20R\x27\x20U2\x20L\x27\x20U\x20R\x20U\x27\x20M\x27\x20x\x27',
    'ZBLL\x20AS\x2016': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20L',
    'ZBLL\x20AS\x2017': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20F\x27\x20U\x20R',
    'ZBLL\x20AS\x2018': 'R\x27\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x27\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27',
    'ZBLL\x20AS\x2019': 'R\x20U\x27\x20L\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27',
    'ZBLL\x20AS\x2020': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2',
    'ZBLL\x20AS\x2021': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'ZBLL\x20AS\x2022': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R2\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2023': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20R',
    'ZBLL\x20AS\x2024': 'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R2',
    'ZBLL\x20AS\x2025': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
    'ZBLL\x20AS\x2026': 'y2\x20R\x27\x20U2\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20U2\x20R',
    'ZBLL\x20AS\x2027': 'R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20AS\x2028': 'y\x20R\x20U2\x20R\x20D\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20D\x27\x20R2',
    'ZBLL\x20AS\x2029': 'y2\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20AS\x2030': 'R\x27\x20U\x20L\x20U\x27\x20R\x20U\x20L\x27',
    'ZBLL\x20AS\x2031': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
    'ZBLL\x20AS\x2032': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R',
    'ZBLL\x20AS\x2033': 'y2\x20L\x27\x20U\x20R\x20U\x27\x20L\x20R\x20U\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R2',
    'ZBLL\x20AS\x2034': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x20F2\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20F2\x20R2',
    'ZBLL\x20AS\x2035': 'y\x27\x20L\x20U\x20D\x27\x20L\x20U\x27\x20L\x27\x20U2\x20D\x20L2\x20U\x27\x20L\x20U\x20L',
    'ZBLL\x20AS\x2036': 'y2\x20R\x27\x20U\x27\x20R\x20F2\x20R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F2',
    'ZBLL\x20AS\x2037': 'L\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2038': 'y\x27\x20R\x20U2\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2039': 'x\x27\x20M\x27\x20U\x27\x20R\x20U\x20L\x27\x20U2\x20R\x27\x20U2\x20R',
    'ZBLL\x20AS\x2040': 'y\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20AS\x2041': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R',
    'ZBLL\x20AS\x2042': 'y\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U\x20R\x20U\x27\x20L\x20R\x27',
    'ZBLL\x20AS\x2043': 'y2\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2044': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U2\x20R\x20U\x27\x20L',
    'ZBLL\x20AS\x2045': 'R\x20U2\x20R\x27\x20U\x20R\x20U\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2046': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20L\x20U\x27\x20R2\x20U\x20L\x27\x20U2\x20R',
    'ZBLL\x20AS\x2047': 'y2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2048': 'y\x20F\x20R\x20U\x20R2\x20U2\x20R2\x20U\x20R2\x20U\x20R\x20F\x27',
    'ZBLL\x20AS\x2049': 'R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2050': 'y\x27\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
    'ZBLL\x20AS\x2051': 'y2\x20F\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20AS\x2052': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U2\x20R',
    'ZBLL\x20AS\x2053': 'y2\x20R\x27\x20U\x27\x20R2\x20U\x27\x20L\x20U2\x20R\x27\x20U\x20R\x20U2\x20R2\x20L\x27\x20U2\x20R',
    'ZBLL\x20AS\x2054': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20L\x27\x20U\x20L\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U2\x20L',
    'ZBLL\x20AS\x2055': 'y\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20AS\x2056': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U2\x20R\x27',
    'ZBLL\x20AS\x2057': 'y\x20R\x20U\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U2\x20L\x20U2\x20L\x27\x20R\x27\x20U2\x20L',
    'ZBLL\x20AS\x2058': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x27\x20F\x27',
    'ZBLL\x20AS\x2059': 'y2\x20R\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R2',
    'ZBLL\x20AS\x2060': 'y\x20L\x20R\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x27\x20U\x20L\x20U\x27\x20R2\x20U\x20R\x27\x20U\x20L\x27',
    'ZBLL\x20AS\x2061': 'y\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R2\x20U\x20R2\x20U\x27\x20R\x27\x20U\x20R2\x20U\x20R2',
    'ZBLL\x20AS\x2062': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20AS\x2063': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R2',
    'ZBLL\x20AS\x2064': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20AS\x2065': 'R\x27\x20U\x27\x20R2\x20U\x20R2\x20U\x20R2\x20U2\x20R2\x20U2\x20R',
    'ZBLL\x20AS\x2066': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2067': 'R\x20U2\x20R2\x20U2\x20R2\x20U\x20R2\x20U\x20R2\x20U\x27\x20R\x27',
    'ZBLL\x20AS\x2068': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20AS\x2069': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20AS\x2070': 'R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U\x20R\x20U\x20R2',
    'ZBLL\x20AS\x2071': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20AS\x2072': 'y\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2',
    'ZBLL\x20H\x201': 'y\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20H\x202': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27',
    'ZBLL\x20H\x203': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R',
    'ZBLL\x20H\x204': 'y\x27\x20R\x20U2\x20R2\x20F\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20F\x27\x20U\x20R',
    'ZBLL\x20H\x205': 'y\x27\x20R\x20B\x27\x20R\x27\x20B\x20U2\x20R2\x20F\x27\x20r\x20U\x27\x20r\x27\x20F2\x20R2',
    'ZBLL\x20H\x206': 'y\x27\x20R\x20U\x27\x20R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U\x27\x20R\x20U2\x20R\x27',
    'ZBLL\x20H\x207': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20H\x208': 'y2\x20F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20H\x209': 'R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R',
    'ZBLL\x20H\x2010': 'y\x27\x20R\x27\x20U2\x20R\x20U2\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20U\x20R',
    'ZBLL\x20H\x2011': 'y\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20H\x2012': 'F\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20F\x27',
    'ZBLL\x20H\x2013': 'y2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
    'ZBLL\x20H\x2014': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20H\x2015': 'y2\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20U\x27\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'ZBLL\x20H\x2016': 'y\x27\x20R\x20U2\x20R2\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R',
    'ZBLL\x20H\x2017': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27',
    'ZBLL\x20H\x2018': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R2\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'ZBLL\x20H\x2019': 'D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x20U\x20R\x20U\x27\x20R2',
    'ZBLL\x20H\x2020': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20H\x2021': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27',
    'ZBLL\x20H\x2022': 'R\x20U\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'ZBLL\x20H\x2023': 'y\x20R\x27\x20F\x20R\x27\x20F\x27\x20R2\x20U\x27\x20r\x27\x20U\x20r\x20U\x27\x20r\x27\x20U\x27\x20r',
    'ZBLL\x20H\x2024': 'y\x27\x20l\x20U\x27\x20R\x20U\x20R\x27\x20l\x27\x20U\x20r\x20U\x27\x20r\x27\x20U\x20r\x20U\x20r\x27',
    'ZBLL\x20H\x2025': 'F\x20U\x27\x20R2\x20U\x20R\x20U2\x20R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20F\x27',
    'ZBLL\x20H\x2026': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20H\x2027': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20H\x2028': 'x\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F2\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20x',
    'ZBLL\x20H\x2029': 'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20H\x2030': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20H\x2031': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20L\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27',
    'ZBLL\x20H\x2032': 'y\x27\x20R\x20U\x20R\x27\x20U\x20y\x27\x20R\x27\x20U\x20R\x20U\x27\x20R2\x20F\x20R\x20F\x27\x20R',
    'ZBLL\x20H\x2033': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20H\x2034': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20H\x2035': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20H\x2036': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20H\x2037': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20H\x2038': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20H\x2039': 'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20H\x2040': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20L\x201': 'y\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x202': 'y\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20L\x203': 'y\x27\x20R\x27\x20U2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x20R',
    'ZBLL\x20L\x204': 'R\x27\x20U2\x20R\x27\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2',
    'ZBLL\x20L\x205': 'R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U2\x20R',
    'ZBLL\x20L\x206': 'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'ZBLL\x20L\x207': 'R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20y\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20L\x208': 'y\x20R\x20U2\x20R\x27\x20F\x20U2\x20F\x27\x20U\x27\x20R\x20F\x20U\x27\x20F\x27\x20U2\x20R\x27',
    'ZBLL\x20L\x209': 'R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20D\x27\x20U\x27\x20R\x27\x20U\x20R\x27',
    'ZBLL\x20L\x2010': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2011': 'R\x27\x20U\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20L\x2012': 'y\x27\x20R\x20U\x27\x20R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U2\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2013': 'y2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20B2\x20R\x27\x20U2\x20R\x20U2\x20R\x20B2\x20R2',
    'ZBLL\x20L\x2014': 'y\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R',
    'ZBLL\x20L\x2015': 'L\x20U\x27\x20R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2016': 'R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x27\x20R\x27\x20U2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20L\x2017': 'y\x27\x20R\x20U2\x20R2\x20U\x20L\x20U\x27\x20L\x27\x20R\x20U2\x20R\x20U\x20L\x20U2\x20L\x27\x20R\x27',
    'ZBLL\x20L\x2018': 'x\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x27\x20D\x27\x20x',
    'ZBLL\x20L\x2019': 'y\x27\x20R\x27\x20U2\x20R\x20U2\x20D\x27\x20R\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R2\x20D',
    'ZBLL\x20L\x2020': 'R\x20F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20F\x27\x20R\x27',
    'ZBLL\x20L\x2021': 'y\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
    'ZBLL\x20L\x2022': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U\x20R\x20U\x27\x20M\x27\x20x\x27',
    'ZBLL\x20L\x2023': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20L\x2024': 'F\x27\x20r\x27\x20F\x20r\x20U\x20r\x27\x20F2\x20r\x20U\x20F',
    'ZBLL\x20L\x2025': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R2',
    'ZBLL\x20L\x2026': 'y\x27\x20R\x27\x20U\x20L\x27\x20U\x27\x20L\x20R\x20U2\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
    'ZBLL\x20L\x2027': 'R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27',
    'ZBLL\x20L\x2028': 'y2\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20U2\x20R\x20U\x20R\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20L\x2029': 'y2\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R',
    'ZBLL\x20L\x2030': 'y\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20L\x2031': 'y\x20R\x27\x20L\x27\x20U\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20L\x2032': 'y\x20R\x27\x20U\x27\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20L\x2033': 'y2\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2034': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2035': 'R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20L\x2036': 'y\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20L\x2037': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
    'ZBLL\x20L\x2038': 'y2\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
    'ZBLL\x20L\x2039': 'R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27',
    'ZBLL\x20L\x2040': 'y\x20R\x20U2\x20R\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2',
    'ZBLL\x20L\x2041': 'y\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
    'ZBLL\x20L\x2042': 'y\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U2\x20R\x27',
    'ZBLL\x20L\x2043': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20L\x2044': 'y\x27\x20R\x20U\x20R\x27\x20F\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20F\x20R\x27\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20L\x2045': 'y\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
    'ZBLL\x20L\x2046': 'y\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R',
    'ZBLL\x20L\x2047': 'y\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20D\x20R\x20U\x27\x20R',
    'ZBLL\x20L\x2048': 'L\x27\x20U\x20L2\x20F2\x20L\x27\x20U2\x20L\x27\x20U2\x20L\x20F2\x20U2\x20L\x27\x20U\x20L',
    'ZBLL\x20L\x2049': 'y\x20r\x20U2\x20r2\x20F\x20R\x20F\x27\x20r2\x20R\x27\x20U2\x20r\x27',
    'ZBLL\x20L\x2050': 'R\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U\x20M\x27\x20x\x27\x20U\x20L\x27\x20U\x20L',
    'ZBLL\x20L\x2051': 'y\x27\x20L\x27\x20U2\x20L\x20U\x20R\x20U2\x20L\x27\x20U\x27\x20M\x27\x20x\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2052': 'r\x20U2\x20R\x20r2\x20F\x20R\x27\x20F\x27\x20r2\x20U2\x20r\x27',
    'ZBLL\x20L\x2053': 'r\x20U\x20M\x20U\x20R\x27\x20U\x27\x20r\x20U\x27\x20r\x27\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20L\x2054': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20r\x20U\x20r\x27\x20U\x20R\x20U\x27\x20M\x27\x20U\x27\x20r\x27',
    'ZBLL\x20L\x2055': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F2',
    'ZBLL\x20L\x2056': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20U\x20R',
    'ZBLL\x20L\x2057': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2',
    'ZBLL\x20L\x2058': 'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20L\x2059': 'y\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2060': 'y\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20L\x2061': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U2\x20R2\x20U2\x20R\x27',
    'ZBLL\x20L\x2062': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20L\x2063': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20L\x2064': 'y\x20R2\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R2',
    'ZBLL\x20L\x2065': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20L\x2066': 'y2\x20R2\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R2',
    'ZBLL\x20L\x2067': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20L\x2068': 'R2\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x27\x20R2',
    'ZBLL\x20L\x2069': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20L\x2070': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20L\x2071': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20L\x2072': 'R\x20U\x27\x20R\x27\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x20L\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x201': 'R\x27\x20U2\x20R\x20U\x27\x20L\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20L\x27',
    'ZBLL\x20Pi\x202': 'R\x20U2\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L',
    'ZBLL\x20Pi\x203': 'y2\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x204': 'y2\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x205': 'R\x20U\x20R\x27\x20F\x27\x20U\x27\x20R\x20U2\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20F\x20R2\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x206': 'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20Pi\x207': 'R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x208': 'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20Pi\x209': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20F',
    'ZBLL\x20Pi\x2010': 'y\x27\x20F\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20F\x27',
    'ZBLL\x20Pi\x2011': 'y\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20Pi\x2012': 'R\x27\x20U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U2\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x2013': 'y\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2',
    'ZBLL\x20Pi\x2014': 'y\x27\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U\x27\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
    'ZBLL\x20Pi\x2015': 'R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x2016': 'R\x20U\x20R\x27\x20U\x20R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2017': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'ZBLL\x20Pi\x2018': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R\x20F\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R',
    'ZBLL\x20Pi\x2019': 'y\x27\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2020': 'y2\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20r\x27\x20F2\x20r\x20U2\x20R\x27\x20U\x27\x20r\x27\x20F\x20r',
    'ZBLL\x20Pi\x2021': 'y2\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2022': 'R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2023': 'R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x2024': 'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
    'ZBLL\x20Pi\x2025': 'R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x2026': 'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F',
    'ZBLL\x20Pi\x2027': 'y\x20L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2028': 'y2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R',
    'ZBLL\x20Pi\x2029': 'y\x20F\x20U\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R2\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2030': 'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2031': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20x\x20U\x27\x20L\x20U\x27\x20L\x27\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20x\x27',
    'ZBLL\x20Pi\x2032': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20F2\x20r\x20U2\x20r\x27\x20U\x27\x20r\x27\x20F\x20r',
    'ZBLL\x20Pi\x2033': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20B2\x20R\x27\x20U2\x20R\x20U2\x20l\x20U2\x20l\x27',
    'ZBLL\x20Pi\x2034': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2',
    'ZBLL\x20Pi\x2035': 'y\x20R2\x20F2\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F2\x20R2\x20U\x20R\x27\x20F2\x20R',
    'ZBLL\x20Pi\x2036': 'R\x27\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2037': 'R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x2038': 'R\x20U\x20R\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2039': 'L\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R\x20U\x20L\x27\x20U\x27\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2040': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x20R',
    'ZBLL\x20Pi\x2041': 'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20Pi\x2042': 'y2\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27\x20U\x20L\x27',
    'ZBLL\x20Pi\x2043': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R2\x20F2\x20U\x20R\x20U\x20R2\x20U\x27\x20R\x27\x20U\x27\x20F2\x20R2',
    'ZBLL\x20Pi\x2044': 'r\x27\x20F\x27\x20r\x20U\x20r\x20U2\x20r\x27\x20F2\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2045': 'l\x20U2\x20l\x27\x20U2\x20R\x27\x20U2\x20R\x20B2\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x2046': 'y2\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x2047': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
    'ZBLL\x20Pi\x2048': 'y\x27\x20R\x20U\x20R\x27\x20U\x20F2\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R',
    'ZBLL\x20Pi\x2049': 'R\x20U\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20Pi\x2050': 'y\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20F\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2051': 'y2\x20F\x20R2\x20U\x27\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x20R2\x20F\x27',
    'ZBLL\x20Pi\x2052': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2053': 'F\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R\x20U2\x20R\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20Pi\x2054': 'y\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'ZBLL\x20Pi\x2055': 'R2\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2056': 'R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x2057': 'y2\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2058': 'F\x20R2\x20U\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R2\x20F\x27',
    'ZBLL\x20Pi\x2059': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x2060': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20Pi\x2061': 'R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20Pi\x2062': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20Pi\x2063': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27',
    'ZBLL\x20Pi\x2064': 'y\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R',
    'ZBLL\x20Pi\x2065': 'y2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2066': 'y2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x2067': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20Pi\x2068': 'R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2069': 'R\x27\x20U\x27\x20R\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20Pi\x2070': 'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2071': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20Pi\x2072': 'R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x201': 'L\x27\x20U2\x20L\x20U2\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20L',
    'ZBLL\x20S\x202': 'y\x20R\x20U2\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x203': 'R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27',
    'ZBLL\x20S\x204': 'y2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U2\x20R\x27',
    'ZBLL\x20S\x205': 'L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U\x20R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'ZBLL\x20S\x206': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20B\x27\x20U\x20R2\x20U\x20R2\x20U\x27\x20B\x20U\x27\x20R\x27',
    'ZBLL\x20S\x207': 'y\x20R\x27\x20U\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20U\x27\x20R\x20F2\x20R\x27\x20U\x20F2\x20R2',
    'ZBLL\x20S\x208': 'y2\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U',
    'ZBLL\x20S\x209': 'y\x27\x20R\x27\x20U2\x20R\x27\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2010': 'y2\x20R\x20U\x20R\x27\x20U\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
    'ZBLL\x20S\x2011': 'R\x20U\x20R2\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20F\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2012': 'R\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2013': 'y2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R',
    'ZBLL\x20S\x2014': 'y\x20F\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20l\x20U\x27\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20x',
    'ZBLL\x20S\x2015': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20U2\x20R',
    'ZBLL\x20S\x2016': 'y2\x20R\x20U2\x20R\x27\x20U\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2017': 'y\x20R\x20U2\x20L\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2018': 'R\x27\x20D\x20R2\x20D\x27\x20R2\x20U\x20R2\x20D\x20R2\x20D\x27\x20R2\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2019': 'R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2020': 'y\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2021': 'y\x27\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2022': 'y\x20R\x20D\x27\x20R2\x20U\x27\x20F2\x20U\x27\x20F2\x20R\x20U2\x20R2\x20D\x20R2',
    'ZBLL\x20S\x2023': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2',
    'ZBLL\x20S\x2024': 'y2\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2025': 'R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2026': 'y\x27\x20R\x27\x20U2\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20U2\x20R',
    'ZBLL\x20S\x2027': 'R\x27\x20U2\x20R\x20L\x20U2\x20R\x27\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x20U2\x20L\x27',
    'ZBLL\x20S\x2028': 'L\x20U2\x20L\x20F\x20L\x27\x20U\x27\x20L\x27\x20U\x20L\x20F\x27\x20U2\x20L\x27',
    'ZBLL\x20S\x2029': 'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'ZBLL\x20S\x2030': 'D\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20D\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x20R2',
    'ZBLL\x20S\x2031': 'L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2032': 'y\x27\x20R2\x20U\x20R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U\x20R\x20D\x27',
    'ZBLL\x20S\x2033': 'y\x20R\x27\x20U\x20R2\x20D\x20R2\x20U\x27\x20R2\x20U\x20R2\x20U\x20D\x27\x20R2\x20U2\x20R2\x20U\x20R',
    'ZBLL\x20S\x2034': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20S\x2035': 'R2\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'ZBLL\x20S\x2036': 'y\x27\x20R\x27\x20U\x27\x20D\x20R\x27\x20U\x20R\x20U2\x20D\x27\x20R2\x20U\x20R\x27\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2037': 'L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2038': 'y\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27',
    'ZBLL\x20S\x2039': 'y\x20R\x27\x20U2\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U2\x20R',
    'ZBLL\x20S\x2040': 'f\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20U2\x20S\x27',
    'ZBLL\x20S\x2041': 'y\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20L',
    'ZBLL\x20S\x2042': 'y\x20F\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20S\x2043': 'y2\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2044': 'R\x27\x20D\x20R\x27\x20U\x20R\x20D\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2045': 'y\x20L\x20U2\x20L\x27\x20U2\x20R\x27\x20U\x20L\x20U\x27\x20L\x27\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2046': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
    'ZBLL\x20S\x2047': 'R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2048': 'y2\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2049': 'y\x20R\x20U2\x20L\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2050': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L',
    'ZBLL\x20S\x2051': 'y\x27\x20R\x20U\x27\x20R2\x20U2\x20D\x27\x20R\x20U\x20R\x27\x20U\x20D\x20R2\x20U\x20R\x27',
    'ZBLL\x20S\x2052': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U2\x20R\x27\x20U2\x20R\x20U2\x20L\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20S\x2053': 'y\x27\x20R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x20R\x27\x20U\x27\x20L\x27\x20U\x20L',
    'ZBLL\x20S\x2054': 'y2\x20L\x27\x20U2\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20L\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2055': 'y\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U2\x20R',
    'ZBLL\x20S\x2056': 'y\x27\x20R\x20U2\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20L\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2057': 'y2\x20R\x20U\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U2\x20R\x27',
    'ZBLL\x20S\x2058': 'F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20F\x27\x20R\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20S\x2059': 'R\x27\x20U2\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2060': 'F\x20R\x20U\x27\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20S\x2061': 'y2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27',
    'ZBLL\x20S\x2062': 'y\x27\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R2',
    'ZBLL\x20S\x2063': 'R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R2\x20U2\x20R\x27',
    'ZBLL\x20S\x2064': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2065': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2066': 'y\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20S\x2067': 'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20S\x2068': 'R\x27\x20U2\x20R2\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20R',
    'ZBLL\x20S\x2069': 'R\x20U\x20R\x27\x20U\x20R2\x20U\x20R\x20U\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2',
    'ZBLL\x20S\x2070': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20S\x2071': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20S\x2072': 'R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20L\x20F2\x20L\x27\x20U2\x20R2\x20D\x20R2',
    'ZBLL\x20T\x201': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U\x27\x20L\x20R\x20U2\x20L\x27\x20U\x27\x20L',
    'ZBLL\x20T\x202': 'R2\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U2\x20R\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L',
    'ZBLL\x20T\x203': 'R2\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20R\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x204': 'y\x20R2\x20U\x20R2\x20U\x20R2\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R',
    'ZBLL\x20T\x205': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27',
    'ZBLL\x20T\x206': 'y\x20l\x27\x20U\x27\x20L\x20U\x20R\x20U\x27\x20r\x27\x20F',
    'ZBLL\x20T\x207': 'R\x27\x20U2\x20R\x20F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20F\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x208': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20L',
    'ZBLL\x20T\x209': 'y\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20T\x2010': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x20U2\x20R\x20U2\x20R\x27\x20F',
    'ZBLL\x20T\x2011': 'x\x27\x20M\x27\x20U\x27\x20R\x20U\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2012': 'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U\x20R',
    'ZBLL\x20T\x2013': 'y2\x20R2\x20B2\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x20B2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2014': 'R\x20D\x27\x20R\x27\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R\x27\x20D\x20R\x27',
    'ZBLL\x20T\x2015': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27\x20U\x20L\x27',
    'ZBLL\x20T\x2016': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20U2\x20R\x20U\x20R\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20T\x2017': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
    'ZBLL\x20T\x2018': 'y\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x20R',
    'ZBLL\x20T\x2019': 'y2\x20R\x20U2\x20R\x27\x20B\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20B\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2020': 'y\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20R\x20U\x20R\x27\x20L\x27',
    'ZBLL\x20T\x2021': 'y\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20T\x2022': 'y\x27\x20F\x27\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20F',
    'ZBLL\x20T\x2023': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2024': 'y2\x20R\x20L\x27\x20U\x20R\x27\x20U\x27\x20L\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2025': 'R\x27\x20U\x20R\x20U2\x20L\x27\x20R\x27\x20U\x20R\x20U\x27\x20L',
    'ZBLL\x20T\x2026': 'y\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2027': 'y2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27\x20U\x20L\x27',
    'ZBLL\x20T\x2028': 'y\x27\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2029': 'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20T\x2030': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20F\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20T\x2031': 'y2\x20r\x20U\x27\x20r\x20U2\x20R\x27\x20F\x20R\x20U2\x20r2\x20F',
    'ZBLL\x20T\x2032': 'y2\x20R\x27\x20U\x27\x20R2\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2033': 'R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R2\x20U\x27\x20D\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2034': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20L',
    'ZBLL\x20T\x2035': 'F\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20F\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2036': 'y\x20L\x27\x20U2\x20R\x20U2\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2037': 'y\x20R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20L\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2038': 'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x27\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20T\x2039': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20F\x20U\x27\x20R\x27\x20U\x20R\x20U\x20F\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2040': 'y2\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20T\x2041': 'y\x27\x20l\x27\x20U2\x20R\x27\x20D2\x20R\x20U2\x20R\x27\x20D2\x20R2\x20x\x27',
    'ZBLL\x20T\x2042': 'y\x27\x20l\x20U2\x20R\x20D2\x20R\x27\x20U2\x20R\x20D2\x20R2\x20x',
    'ZBLL\x20T\x2043': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
    'ZBLL\x20T\x2044': 'y2\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20L',
    'ZBLL\x20T\x2045': 'y\x20R\x27\x20U\x27\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20T\x2046': 'R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x20U2\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27',
    'ZBLL\x20T\x2047': 'L\x27\x20U\x27\x20L\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20L\x27\x20U\x20M\x27\x20x\x27',
    'ZBLL\x20T\x2048': 'y2\x20R\x20U\x27\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
    'ZBLL\x20T\x2049': 'y\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2050': 'R\x27\x20U\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R2',
    'ZBLL\x20T\x2051': 'y\x20R\x20U\x27\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2052': 'R2\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2',
    'ZBLL\x20T\x2053': 'y2\x20r2\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
    'ZBLL\x20T\x2054': 'y2\x20R2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x27\x20R\x27\x20U\x27\x20R2\x20U2\x20R\x20U2\x20R',
    'ZBLL\x20T\x2055': 'y2\x20R\x20U\x27\x20R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R2\x20U\x20R\x27',
    'ZBLL\x20T\x2056': 'R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U\x27\x20R',
    'ZBLL\x20T\x2057': 'y2\x20R2\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x20U\x20R2\x20U\x20R2',
    'ZBLL\x20T\x2058': 'y\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R2',
    'ZBLL\x20T\x2059': 'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2060': 'y2\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20T\x2061': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2062': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2063': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
    'ZBLL\x20T\x2064': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20T\x2065': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27',
    'ZBLL\x20T\x2066': 'y2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20T\x2067': 'y\x27\x20R\x27\x20U\x27\x20R2\x20U\x20R2\x20U\x20R2\x20U2\x20R\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2068': 'y\x27\x20R\x20U\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2069': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20T\x2070': 'y2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2071': 'R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20T\x2072': 'y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x201': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'ZBLL\x20U\x202': 'y\x27\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20U\x203': 'y2\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R\x27\x20U2\x20R\x27',
    'ZBLL\x20U\x204': 'y\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20U\x205': 'y\x27\x20R\x20U2\x20R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27',
    'ZBLL\x20U\x206': 'y2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
    'ZBLL\x20U\x207': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20D\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20D\x27',
    'ZBLL\x20U\x208': 'R\x27\x20U\x27\x20R\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20U\x20F\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20U\x209': 'y\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20U\x2010': 'y\x20R\x27\x20U\x20R\x27\x20U\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x27\x20R',
    'ZBLL\x20U\x2011': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x27\x20R\x27\x20U2\x20L\x27\x20U2\x20R\x20U\x27\x20L\x20U2\x20L\x27',
    'ZBLL\x20U\x2012': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x20R\x27',
    'ZBLL\x20U\x2013': 'R2\x20D\x27\x20r\x20U2\x20r\x27\x20D\x20R\x20U2\x20R',
    'ZBLL\x20U\x2014': 'y\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x2015': 'y2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27',
    'ZBLL\x20U\x2016': 'y\x27\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20U\x2017': 'R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
    'ZBLL\x20U\x2018': 'y\x27\x20R\x27\x20U2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2\x20U\x20R\x20U2\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x2019': 'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20D',
    'ZBLL\x20U\x2020': 'R\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x20R\x27\x20U\x27\x20R\x27\x20U2\x20R\x27',
    'ZBLL\x20U\x2021': 'R\x20U\x27\x20R\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U2\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2',
    'ZBLL\x20U\x2022': 'y\x27\x20L\x20U\x20R\x27\x20U\x20L\x27\x20U\x27\x20R\x20U\x27\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
    'ZBLL\x20U\x2023': 'y\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x27\x20R',
    'ZBLL\x20U\x2024': 'y\x27\x20R\x20U\x20R\x27\x20U2\x20F2\x20R\x20U2\x20R\x27\x20U2\x20R\x27\x20F2\x20R2\x20U\x20R\x27',
    'ZBLL\x20U\x2025': 'R\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R',
    'ZBLL\x20U\x2026': 'y2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R\x27\x20U2\x20R\x27',
    'ZBLL\x20U\x2027': 'y\x27\x20F2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F2',
    'ZBLL\x20U\x2028': 'y\x20R\x20U\x27\x20L\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20l\x20U2\x20R\x20U2\x20R2\x20x',
    'ZBLL\x20U\x2029': 'y\x27\x20F\x20U\x20R2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R2\x20F\x27\x20R\x27\x20U\x20R',
    'ZBLL\x20U\x2030': 'y\x27\x20R\x27\x20U\x27\x20R\x20F\x20R2\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20F\x27',
    'ZBLL\x20U\x2031': 'y\x20R\x27\x20U\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x2032': 'y\x27\x20R2\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20U\x2033': 'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'ZBLL\x20U\x2034': 'y\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
    'ZBLL\x20U\x2035': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20U\x2036': 'y\x27\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20U\x2037': 'y2\x20R\x20U\x20R\x27\x20U\x27\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20L\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20U\x2038': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
    'ZBLL\x20U\x2039': 'R\x27\x20U\x27\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20U\x2040': 'y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
    'ZBLL\x20U\x2041': 'x\x27\x20R2\x20D2\x20R\x27\x20U2\x20R\x20D2\x20R\x27\x20U2\x20R\x27\x20x',
    'ZBLL\x20U\x2042': 'y2\x20x\x20R2\x20D2\x20R\x20U2\x20R\x27\x20D2\x20R\x20U2\x20R\x20x\x27',
    'ZBLL\x20U\x2043': 'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'ZBLL\x20U\x2044': 'y2\x20R\x20U\x27\x20R2\x20F\x20R\x20U\x20R\x20U\x27\x20R2\x20F\x27\x20R\x20U\x27\x20F\x27\x20U\x20F',
    'ZBLL\x20U\x2045': 'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R2\x20U\x27\x20R',
    'ZBLL\x20U\x2046': 'y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x20R\x27',
    'ZBLL\x20U\x2047': 'R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R',
    'ZBLL\x20U\x2048': 'R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20F\x27\x20R\x27',
    'ZBLL\x20U\x2049': 'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R2',
    'ZBLL\x20U\x2050': 'y\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20F\x20U\x20R',
    'ZBLL\x20U\x2051': 'R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L',
    'ZBLL\x20U\x2052': 'R\x27\x20U2\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
    'ZBLL\x20U\x2053': 'F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20U\x2054': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20M\x20U\x20R\x20U\x27\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
    'ZBLL\x20U\x2055': 'y\x27\x20R\x20U2\x20R2\x20F\x20R\x20F\x27\x20M\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20M',
    'ZBLL\x20U\x2056': 'y\x20R\x20U\x20R\x27\x20L\x27\x20U2\x20R\x20U\x20R\x27\x20L\x20U\x20L\x27\x20U\x20L',
    'ZBLL\x20U\x2057': 'L\x20U2\x20L\x27\x20F\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20F',
    'ZBLL\x20U\x2058': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x27\x20F\x20R2\x20B\x27\x20R2\x20F\x27\x20R2\x20B\x20R\x27',
    'ZBLL\x20U\x2059': 'L\x20U2\x20R\x27\x20U\x20R\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x2060': 'y2\x20R\x20U\x20R\x27\x20U\x20L\x27\x20R\x20U\x20R\x27\x20U\x27\x20L\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20U\x2061': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20U\x2062': 'y\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27',
    'ZBLL\x20U\x2063': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20U\x2064': 'y\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'ZBLL\x20U\x2065': 'y\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x2066': 'y\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R',
    'ZBLL\x20U\x2067': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R2\x20U\x27\x20R\x27',
    'ZBLL\x20U\x2068': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U\x20R',
    'ZBLL\x20U\x2069': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'ZBLL\x20U\x2070': 'y2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R',
    'ZBLL\x20U\x2071': 'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x20U2\x20R2\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R2',
    'ZBLL\x20U\x2072': 'y\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R'
};
NxN_AlgHandler['COLLDictionary'] = {
    'L\x201': 'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27',
    'L\x202': 'R\x27\x20U2\x20R\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R2',
    'L\x203': 'y\x20R\x20U2\x20R\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R2',
    'L\x204': 'y2\x20R2\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27\x20U\x27\x20R\x27',
    'L\x205': 'y2\x20F\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R',
    'L\x206': 'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2',
    'U\x201': 'R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'U\x202': 'R\x27\x20F\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R',
    'U\x203': 'y2\x20R2\x20D\x20R\x27\x20U2\x20R\x20D\x27\x20R\x27\x20U2\x20R\x27',
    'U\x204': 'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20F\x27',
    'U\x205': 'R2\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R\x20U2\x20R',
    'U\x206': 'R\x27\x20U2\x20R\x20F\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20F\x27',
    'T\x201': 'R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R',
    'T\x202': 'R\x27\x20U\x20R\x20U2\x20R\x27\x20L\x27\x20U\x20R\x20U\x27\x20L',
    'T\x203': 'y\x20l\x27\x20U\x27\x20L\x20U\x20R\x20U\x27\x20r\x27\x20F',
    'T\x204': 'y2\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27',
    'T\x205': 'y\x27\x20r\x20U\x20R\x27\x20U\x27\x20r\x27\x20F\x20R\x20F\x27',
    'T\x206': 'R\x27\x20U\x20R2\x20D\x20r\x27\x20U2\x20r\x20D\x27\x20R2\x20U\x27\x20R',
    'Pi\x201': 'R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R2\x20U2\x20R',
    'Pi\x202': 'R\x27\x20F2\x20R\x20U2\x20R\x20U2\x20R\x27\x20F2\x20U\x27\x20R\x20U\x27\x20R\x27',
    'Pi\x203': 'R\x27\x20U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U2\x20R\x27\x20U2\x20R',
    'Pi\x204': 'R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R2\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
    'Pi\x205': 'R\x20U\x27\x20L\x27\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L',
    'Pi\x206': 'R\x20U\x20D\x27\x20R\x20U\x20R\x27\x20D\x20R2\x20U\x27\x20R\x27\x20U\x27\x20R2\x20U2\x20R',
    'H\x201': 'R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27',
    'H\x202': 'F\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27',
    'H\x203': 'R\x20U\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x20R\x27\x20U\x27\x20L',
    'H\x204': 'y\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x27'
};
NxN_AlgHandler['F2LDictionary'] = {
    'F2L\x201': [
        [
            'U\x20R\x20U\x27\x20R\x27',
            'R\x27\x20F\x20R\x20F\x27',
            'U2\x20R\x20U2\x20R\x27'
        ],
        [
            'y\x20U\x20L\x20U\x27\x20L\x27',
            'y\x27\x20U\x20R\x20U\x27\x20R\x27',
            'F\x27\x20r\x20U\x20r\x27',
            'F\x27\x20L\x20F\x20L\x27'
        ],
        [
            'U\x20L\x20U\x27\x20L\x27',
            'U2\x20L\x20U2\x20L\x27',
            'r\x27\x20U\x20L\x20U\x27\x20x'
        ],
        [
            'y\x27\x20U\x20L\x20U\x27\x20L\x27',
            'y\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20R\x27\x20F\x20R\x20F\x27',
            'y\x20U2\x20R\x20U2\x27\x20R\x27',
            'U\x20f\x20R\x27\x20f\x27',
            'U2\x20R2\x27\x20F\x20R\x20F\x27\x20R',
            'r\x27\x20U\x27\x20R\x20U\x20M\x27',
            'U\x20R\x27\x20F\x27\x20U\x27\x20F\x20R'
        ]
    ],
    'F2L\x2010': [
        [
            'R\x27\x20U\x20R2\x20U\x20R\x27',
            'U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'U2\x20L\x27\x20U\x20L\x20U2\x20R\x20U\x20R\x27',
            'U2\x20L\x27\x20U\x20L\x20U2\x20R\x20U\x20R\x27'
        ],
        [
            'y\x20L\x27\x20U\x20L2\x20U\x20L\x27',
            'y\x27\x20R\x27\x20U\x20R2\x20U\x20R\x27',
            'y\x20U2\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'y\x20U\x27\x20L\x20U\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'y\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'y\x27\x20U2\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20F\x27'
        ],
        [
            'L\x27\x20U\x20L2\x20U\x20L\x27',
            'U\x27\x20L\x20U\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'U2\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'
        ],
        [
            'y\x20R\x27\x20U\x20R2\x20U\x20R\x27',
            'y\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'y\x20U2\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'R2\x20U\x27\x20F\x27\x20U\x20F\x20R2',
            'U\x20R\x27\x20U\x20R\x20U\x27\x20f\x20R\x20f\x27',
            'U\x27\x20R\x27\x20U\x27\x20R\x20U2\x27\x20f\x20R\x20f\x27'
        ]
    ],
    'F2L\x2011': [
        [
            'y\x27\x20R\x20U2\x20R2\x27\x20U\x27\x20R',
            'y\x27\x20R\x20U2\x20R2\x27\x20U\x27\x20R2\x20U\x27\x20R\x27',
            'y\x20L\x20U2\x20L2\x20U\x27\x20L',
            'y\x20L\x20U2\x20L2\x27\x20U\x27\x20L2\x20U\x27\x20L\x27',
            'U\x27\x20R\x20U2\x27\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U2\x20L\x27\x20U\x20L',
            'y\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U2\x20L',
            'y\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F',
            'U\x27\x20R\x20U2\x27\x20R\x27\x20U\x20F\x27\x20U\x27\x20F',
            'F\x27\x20U\x20L\x27\x20U2\x27\x20L\x20U2\x20F'
        ],
        [
            'L\x20U2\x20L2\x27\x20U\x27\x20L',
            'L\x20U2\x20L2\x27\x20U\x27\x20L2\x20U\x27\x20L\x27',
            'L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U2\x27\x20L\x27\x20U\x20L'
        ],
        [
            'y\x20R\x20U2\x27\x20R2\x27\x20U\x27\x20R',
            'y\x20R\x20U2\x27\x20R2\x27\x20U\x27\x20R2\x20U\x27\x20R\x27',
            'y\x27\x20L\x20U2\x20L2\x27\x20U\x27\x20L',
            'y\x27\x20L\x20U2\x20L2\x27\x20U\x27\x20L2\x20U\x27\x20L\x27',
            'U\x27\x20L\x20U2\x20L\x27\x20U\x20f\x27\x20L\x27\x20f',
            'y\x20R\x20U2\x27\x20R2\x27\x20U\x27\x20R2\x20U\x27\x20R\x27'
        ],
        [
            'R\x20U2\x27\x20R2\x27\x20U\x27\x20R',
            'R\x20U2\x27\x20R2\x27\x20U\x27\x20R2\x20U\x27\x20R\x27'
        ]
    ],
    'F2L\x2012': [
        [
            'R\x27\x20U2\x20R2\x20U\x20R\x27',
            'R\x27\x20U2\x27\x20R2\x20U\x20R2\x27\x20U\x20R',
            'R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27'
        ],
        [
            'y\x27\x20R\x27\x20U2\x20R2\x20U\x20R\x27',
            'y\x27\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R',
            'y\x20L\x27\x20U2\x20L2\x20U\x20L\x27',
            'y\x20L\x27\x20U2\x20L2\x20U\x20L2\x27\x20U\x20L',
            'F\x20U\x27\x20R\x20U2\x27\x20R\x27\x20U2\x20F\x27'
        ],
        [
            'L\x27\x20U2\x20L2\x20U\x20L\x27',
            'L\x27\x20U2\x20L2\x20U\x20L2\x27\x20U\x20L'
        ],
        [
            'y\x27\x20L\x27\x20U2\x20L2\x20U\x20L\x27',
            'y\x27\x20L\x27\x20U2\x20L2\x20U\x20L2\x20U\x20L',
            'y\x20R\x27\x20U2\x20R2\x20U\x20R\x27',
            'y\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R',
            'U\x20R\x27\x20U2\x27\x20R\x20U\x27\x20f\x20R\x20f\x27',
            'f\x20R\x27\x20U\x20R2\x20U\x27\x20R2\x27\x20f\x27',
            'U\x20R\x27\x20U2\x20R\x20y\x20U\x27\x20R\x20U\x20R\x27',
            'U\x20R\x27\x20U2\x20R\x20y\x27\x20U\x27\x20L\x20U\x20L\x27'
        ]
    ],
    'F2L\x2013': [
        [
            'y\x27\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'y\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'M\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R\x20U\x27\x20r\x27',
            'R\x20U\x27\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27',
            'y\x27\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U\x27\x20R\x27\x20U\x20R\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'y\x27\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'y\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'y\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'F2L\x2014': [
        [
            'U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'U\x20L\x20U\x27\x20L\x27\x20U\x27\x20R\x20U\x20R\x27'
        ],
        [
            'y\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'y\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27'
        ],
        [
            'U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'U\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x20U\x20L\x27'
        ],
        [
            'y\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'y\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27'
        ]
    ],
    'F2L\x2015': [
        [
            'U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'U\x20L\x27\x20U\x20L\x20U\x20R\x20U\x20R\x27',
            'R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27',
            'R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20F\x20R\x20F\x27',
            'U\x20R\x27\x20F\x20R\x20F\x27\x20U\x20R\x20U\x20R\x27',
            'M\x20U\x20r\x20U\x27\x20r\x27\x20U\x27\x20M\x27',
            'R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'
        ],
        [
            'L\x27\x20U\x20L\x20U2\x20F\x20U\x20F\x27',
            'L\x27\x20U\x20L\x20y\x20U2\x20L\x20U\x20L\x27',
            'F\x20U2\x20R\x20U\x20R\x27\x20U\x20F\x27',
            'y\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'y\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x20U\x20L\x27'
        ],
        [
            'U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x20U\x20L\x27',
            'U\x20R\x27\x20U\x20R\x20U\x20L\x20U\x20L\x27',
            'L\x20U\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x20U2\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x20F\x20R\x20U\x27\x20R\x27\x20F\x27\x20L\x27'
        ],
        [
            'y\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'y\x27\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x20U\x20L\x27',
            'R\x27\x20U\x20R\x20U2\x27\x20f\x20R\x20f\x27',
            'R\x27\x20U\x20R\x20y\x20U2\x27\x20R\x20U\x20R\x27',
            'R2\x27\x20F\x20R\x20F\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R',
            'R2\x27\x20F\x20R\x20F\x27\x20R\x20U2\x27\x20R\x27\x20U\x20R',
            'y\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20F\x20R\x20F\x27'
        ]
    ],
    'F2L\x2016': [
        [
            'R\x20U\x27\x20R\x27\x20y\x27\x20U2\x20R\x27\x20U\x27\x20R',
            'R\x20U\x27\x20R\x27\x20y\x20U2\x20L\x27\x20U\x27\x20L',
            'y\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R',
            'y\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x27\x20U\x27\x20L',
            'R\x20U\x27\x20R\x27\x20U2\x20F\x27\x20U\x27\x20F',
            'U\x20M\x27\x20U\x20R\x20U\x27\x20r\x27\x20U\x27\x20R\x20U\x20R\x27',
            'U\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x20R\x27',
            'y\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U\x20L\x20U\x27\x20L\x27\x20U\x20L\x27\x20U\x27\x20L',
            'F\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20F\x27',
            'L\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'L\x20D\x20L\x27\x20U\x20L\x20D\x27\x20L\x27\x20U\x27\x20L\x27\x20U\x20L',
            'F\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20F\x27'
        ],
        [
            'y\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R',
            'L\x20U\x27\x20L\x27\x20y\x27\x20U2\x20L\x27\x20U\x27\x20L',
            'L\x20U\x27\x20L\x27\x20y\x20U2\x20R\x27\x20U\x27\x20R',
            'y\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x27\x20U\x27\x20L',
            'L\x20U\x27\x20L\x27\x20U2\x20f\x27\x20L\x27\x20f',
            'L\x20U\x27\x20L\x27\x20y\x20U2\x20R\x27\x20U\x27\x20R',
            'L\x20U\x27\x20L\x27\x20y\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R',
            'U\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'F\x20R\x27\x20F\x27\x20R\x20U2\x27\x20R\x27\x20U\x27\x20R2\x20U\x27\x20R\x27',
            'f\x20R\x27\x20f\x27\x20U2\x20R\x27\x20U\x27\x20R',
            'f\x20R\x27\x20f\x27\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'M\x27\x20U\x27\x20r\x27\x20U\x20r\x20U\x20M'
        ]
    ],
    'F2L\x2017': [
        ['R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'],
        [
            'y\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'y\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'L\x20F\x27\x20L\x27\x20F\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L'
        ],
        ['L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'],
        [
            'y\x27\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'y\x20R\x20U2\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'
        ]
    ],
    'F2L\x2018': [
        [
            'y\x27\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'y\x27\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20L\x27\x20U2\x27\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'
        ],
        ['L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L'],
        [
            'y\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'y\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x27\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'U\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20L\x20U\x20L\x27'
        ],
        [
            'R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'F2L\x2019': [
        [
            'U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'U\x20R\x20U2\x20R2\x20F\x20R\x20F\x27'
        ],
        [
            'y\x20U\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'y\x27\x20U\x20R\x20U2\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x27\x20U\x20R\x20U2\x27\x20R2\x20F\x20R\x20F\x27',
            'U\x20L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F\x20L\x27\x20U\x20L',
            'U\x20L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F\x20U\x20L\x20F\x27\x20L\x27\x20F'
        ],
        ['U\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'],
        [
            'y\x20U\x20R\x20U2\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20U\x20R\x20U2\x20R2\x20F\x20R\x20F\x27',
            'y\x27\x20U\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'U\x20R\x27\x20F\x27\x20U2\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20R'
        ]
    ],
    'F2L\x202': [
        [
            'F\x20R\x27\x20F\x27\x20R',
            'y\x27\x20U\x27\x20R\x27\x20U\x20R',
            'y\x27\x20U2\x27\x20R\x27\x20U2\x20R',
            'y\x20U\x27\x20L\x27\x20U\x20L',
            'y\x20U2\x20L\x27\x20U2\x20L',
            'r\x20U\x20R\x27\x20U\x27\x20M',
            'U\x27\x20F\x27\x20U\x20F'
        ],
        [
            'U\x27\x20L\x27\x20U\x20L',
            'L\x20F\x27\x20L\x27\x20F',
            'U2\x20L\x27\x20U2\x20L'
        ],
        [
            'y\x20U\x27\x20R\x27\x20U\x20R',
            'y\x27\x20U\x27\x20L\x27\x20U\x20L',
            'U\x27\x20f\x27\x20L\x20f',
            'l\x20U\x20L\x27\x20U\x27\x20M\x27'
        ],
        [
            'U2\x20R\x27\x20U2\x27\x20R',
            'U\x27\x20R\x27\x20U\x20R',
            'U2\x27\x20R\x27\x20U2\x27\x20R'
        ]
    ],
    'F2L\x2020': [
        [
            'y\x27\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'y\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x20U\x27\x20L\x27\x20U2\x20L2\x20F\x27\x20L\x27\x20F',
            'U\x27\x20R\x20U\x27\x20R2\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27'
        ],
        [
            'U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'U\x27\x20L\x27\x20U2\x20L2\x20F\x27\x20L\x27\x20F'
        ],
        [
            'y\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'y\x27\x20U\x27\x20L\x27\x20U2\x20L2\x20F\x27\x20L\x27\x20F',
            'y\x27\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'U\x27\x20L\x20F\x20U2\x20F\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'
        ],
        ['U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R']
    ],
    'F2L\x2021': [
        [
            'U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'U2\x20R\x20U\x20R2\x20F\x20R\x20F\x27',
            'R\x20B\x20U2\x20B\x27\x20R\x27'
        ],
        [
            'F\x20R\x20U2\x20R\x27\x20F\x27',
            'y\x27\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x27\x20U2\x20R\x20U\x20R2\x20F\x20R\x20F\x27',
            'y\x20U2\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'l\x27\x20U\x20l\x20U2\x20l\x27\x20U\x27\x20l',
            'U2\x20F\x20R\x27\x20F\x20R\x20F2',
            'R\x27\x20F\x20R\x20U2\x20R\x27\x20F\x27\x20R'
        ],
        [
            'U2\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x20U\x27\x20L\x27\x20U2\x20L\x20U\x20L\x27',
            'L\x20F\x20U2\x20F\x27\x20L\x27',
            'U2\x20r\x20U\x27\x20r\x20B\x20r2'
        ],
        [
            'y\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20U2\x20R\x20U\x20R2\x20F\x20R\x20F\x27',
            'r\x27\x20U\x20r\x20U2\x27\x20r\x27\x20U\x27\x20r',
            'y\x27\x20U2\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'
        ]
    ],
    'F2L\x2022': [
        [
            'r\x20U\x27\x20r\x27\x20U2\x20r\x20U\x20r\x27',
            'F\x27\x20L\x27\x20U2\x20L\x20F',
            'y\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'y\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R',
            'y\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x20U2\x20L\x27\x20U\x27\x20L2\x20F\x27\x20L\x27\x20F',
            'y\x20L\x27\x20U\x20L\x20U2\x20L\x27\x20U\x27\x20L',
            'L\x20F\x27\x20L\x27\x20U2\x20L\x20F\x20L\x27'
        ],
        [
            'U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'L\x27\x20U\x20L\x20U2\x20L\x27\x20U\x27\x20L',
            'U2\x20L\x27\x20U\x27\x20L2\x20F\x27\x20L\x27\x20F',
            'U2\x20R\x27\x20U\x20L\x27\x20U\x27\x20L\x20R'
        ],
        [
            'y\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'y\x27\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x27\x20U2\x20L\x27\x20U\x27\x20L2\x20F\x27\x20L\x27\x20F',
            'l\x20U\x27\x20l\x27\x20U2\x20l\x20U\x20l\x27'
        ],
        [
            'R\x27\x20U\x20R\x20U2\x27\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U\x20R\x20U2\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U2\x20l\x27\x20U\x20l\x27\x20B\x27\x20l2',
            'U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'U2\x20R\x27\x20F\x20R\x27\x20F\x27\x20R2'
        ]
    ],
    'F2L\x2023': [
        [
            'U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'U\x20F\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x20R\x27',
            'U2\x20R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2',
            'R\x20U\x27\x20R2\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D\x20R',
            'R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'
        ],
        [
            'F\x27\x20U\x27\x20L\x27\x20U\x20L\x20F\x20L\x27\x20U\x20L',
            'y\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20U2\x20L2\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L2'
        ],
        [
            'L\x20U\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'U2\x20L2\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L2'
        ],
        [
            'U\x20R\x27\x20F\x20R\x27\x20F\x27\x20R2\x20U\x27\x20R\x27\x20U\x20R',
            'y\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20F\x20R\x20F\x27',
            'y\x27\x20U2\x20L2\x20U2\x20L\x27\x20U\x27\x20L\x20U\x27\x20L2'
        ]
    ],
    'F2L\x2024': [
        [
            'F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x27',
            'y\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'y\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U\x20R',
            'U\x27\x20R\x20U\x20R2\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27'
        ],
        [
            'U\x27\x20F\x27\x20r\x20U\x20r\x27\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F',
            'F\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20F\x27'
        ],
        [
            'y\x27\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x27\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F',
            'y\x20U2\x20R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R2',
            'U2\x20r\x20U\x20R\x27\x20U\x20R\x20U2\x20B\x20r\x27',
            'U2\x20r\x20U\x20R\x27\x20U\x20R\x20U2\x27\x20B\x20r\x27',
            'U2\x20L\x20F\x20U\x20F2\x27\x20L\x20F\x20L2\x27'
        ],
        [
            'R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U2\x20R2\x20U2\x27\x20R\x20U\x20R\x27\x20U\x20R2',
            'R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U2\x20R',
            'U\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2\x20U\x20R'
        ]
    ],
    'F2L\x2025': [
        [
            'U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x20R\x27',
            'R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20F',
            'U\x27\x20F\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x27\x20F\x20R',
            'R\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R',
            'l\x27\x20U\x27\x20l\x20U\x20l\x20F\x27\x20l\x27\x20F',
            'U\x27\x20D\x27\x20R\x20U\x20R\x27\x20D',
            'U\x27\x20D\x20R\x20U\x20R\x27\x20D\x27',
            'U\x20D\x27\x20R\x20U\x27\x20R\x27\x20D',
            'U\x20D\x20R\x20U\x27\x20R\x27\x20D\x27',
            'U2\x20D\x27\x20R\x20U2\x20R\x27\x20D',
            'U2\x20D\x20R\x20U2\x20R\x27\x20D\x27',
            'D\x27\x20R\x27\x20F\x20R\x20F\x27\x20D'
        ],
        [
            'U\x27\x20L\x27\x20U\x20L\x20F\x27\x20L\x20F\x20L\x27',
            'U\x27\x20L\x27\x20U\x20L\x20y\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20U\x20D\x27\x20L\x20U\x27\x20L\x27\x20D',
            'y\x20U\x20D\x20L\x20U\x27\x20L\x27\x20D\x27',
            'y\x20U2\x20D\x27\x20L\x20U2\x20L\x27\x20D',
            'y\x20U2\x20D\x20L\x20U2\x20L\x27\x20D\x27',
            'y\x20U\x27\x20D\x27\x20L\x20U\x20L\x27\x20D',
            'y\x20U\x27\x20D\x20L\x20U\x20L\x27\x20D\x27'
        ],
        [
            'U\x20D\x27\x20L\x27\x20U\x27\x20L\x20D',
            'U2\x20D\x27\x20L\x27\x20U2\x20L\x20D',
            'U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'U2\x20D\x20L\x27\x20U2\x20L\x20D\x27',
            'U\x27\x20D\x20L\x20U\x20L\x27\x20D\x27',
            'U\x27\x20D\x27\x20L\x20U\x20L\x27\x20D',
            'R\x20D\x27\x20R\x27\x20U\x27\x20R\x20D\x20R\x27\x20L\x20U\x20L\x27',
            'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'U\x27\x20f\x27\x20L\x27\x20f\x20U\x20L\x20U\x20L\x27',
            'U\x27\x20M\x20U\x20L\x20U\x27\x20M\x27\x20U\x20L\x27'
        ],
        [
            'y\x27\x20U\x20D\x20L\x20U\x27\x20L\x27\x20D\x27',
            'y\x27\x20U2\x20D\x20L\x20U2\x20L\x27\x20D\x27',
            'y\x27\x20U\x20D\x27\x20L\x20U\x27\x20L\x27\x20D',
            'y\x27\x20U2\x20D\x27\x20L\x20U2\x20L\x27\x20D',
            'y\x20U\x20D\x27\x20R\x20U\x27\x20R\x27\x20D',
            'y\x20U2\x20D\x27\x20R\x20U2\x20R\x27\x20D',
            'y\x20U\x20D\x20R\x20U\x27\x20R\x27\x20D\x27',
            'y\x20U2\x20D\x20R\x20U2\x20R\x27\x20D\x27',
            'y\x20U\x27\x20D\x27\x20R\x20U\x20R\x27\x20D',
            'y\x20U\x27\x20D\x20R\x20U\x20R\x27\x20D\x27',
            'U\x27\x20R\x27\x20U\x20M\x20U\x27\x20R\x20U\x20M\x27',
            'R\x27\x20S\x27\x20R\x20U\x27\x20R\x27\x20S\x20R',
            'U\x27\x20R\x27\x20U\x20R\x20y\x20U\x20R\x20U\x27\x20R\x27',
            'U2\x20F\x20R2\x20U\x20R2\x20U\x27\x20R2\x20F\x27'
        ]
    ],
    'F2L\x2026': [
        [
            'y\x27\x20U\x27\x20D\x20R\x27\x20U\x20R\x20D\x27',
            'y\x27\x20U\x20D\x20R\x27\x20U\x27\x20R\x20D\x27',
            'y\x27\x20U2\x20D\x20R\x27\x20U2\x27\x20R\x20D\x27',
            'y\x27\x20U\x27\x20D\x27\x20R\x27\x20U\x20R\x20D',
            'y\x27\x20U\x20D\x27\x20R\x27\x20U\x27\x20R\x20D',
            'y\x27\x20U2\x20D\x27\x20R\x27\x20U2\x27\x20R\x20D',
            'y\x20U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'y\x20U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'y\x20U\x27\x20D\x20L\x27\x20U\x20L\x20D\x27',
            'y\x20U2\x20D\x20L\x27\x20U2\x20L\x20D\x27',
            'y\x20U\x20D\x27\x20L\x27\x20U\x27\x20L\x20D',
            'y\x20U\x27\x20D\x27\x20L\x27\x20U\x20L\x20D',
            'y\x20U2\x20D\x27\x20L\x27\x20U2\x20L\x20D',
            'U\x20R\x20U\x27\x20R\x27\x20F\x20R\x27\x20F\x27\x20R',
            'R\x20S\x27\x20R\x27\x20U\x20R\x20S\x20R\x27',
            'U\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x27\x20U\x20F',
            'U\x20R\x20U\x27\x20R\x27\x20y\x27\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'U\x27\x20D\x20L\x27\x20U\x20L\x20D\x27',
            'U2\x20D\x20L\x27\x20U2\x20L\x20D\x27',
            'U\x20D\x27\x20L\x27\x20U\x27\x20L\x20D',
            'U\x27\x20D\x27\x20L\x27\x20U\x20L\x20D',
            'U2\x20D\x27\x20L\x27\x20U2\x20L\x20D',
            'r\x20U\x20r\x27\x20U\x27\x20r\x27\x20F\x20r\x20F\x27',
            'U\x20L\x20F\x27\x20L\x27\x20F\x20L\x27\x20U\x27\x20L',
            'L\x20F\x20L\x27\x20U\x27\x20L\x27\x20U\x20L\x20F\x27'
        ],
        [
            'y\x27\x20U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'y\x27\x20U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'y\x27\x20U\x27\x20D\x20L\x27\x20U\x20L\x20D\x27',
            'y\x27\x20U2\x20D\x20L\x27\x20U2\x20L\x20D\x27',
            'y\x27\x20U\x20D\x27\x20L\x27\x20U\x27\x20L\x20D',
            'y\x27\x20U\x27\x20D\x27\x20L\x27\x20U\x20L\x20D',
            'y\x27\x20U2\x20D\x27\x20L\x27\x20U2\x20L\x20D',
            'y\x20U\x27\x20D\x20R\x27\x20U\x20R\x20D\x27',
            'y\x20U\x20D\x20R\x27\x20U\x27\x20R\x20D\x27',
            'y\x20U2\x20D\x20R\x27\x20U2\x27\x20R\x20D\x27',
            'y\x20U\x27\x20D\x27\x20R\x27\x20U\x20R\x20D',
            'y\x20U\x20D\x27\x20R\x27\x20U\x27\x20R\x20D',
            'y\x20U2\x20D\x27\x20R\x27\x20U2\x27\x20R\x20D',
            'L\x20S\x20L\x27\x20U\x20L\x20S\x27\x20L\x27',
            'U\x20L\x20U\x27\x20L\x27\x20y\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'U\x27\x20D\x20R\x27\x20U\x20R\x20D\x27',
            'U\x20D\x20R\x27\x20U\x27\x20R\x20D\x27',
            'U2\x20D\x20R\x27\x20U2\x27\x20R\x20D\x27',
            'U\x27\x20D\x27\x20R\x27\x20U\x20R\x20D',
            'U\x20D\x27\x20R\x27\x20U\x27\x20R\x20D',
            'U2\x20D\x27\x20R\x27\x20U2\x27\x20R\x20D',
            'R\x20U\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x27',
            'R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R'
        ]
    ],
    'F2L\x2027': [
        [
            'R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'R\x20U\x27\x20R2\x20F\x20R\x20F\x27'
        ],
        [
            'y\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x27\x20R\x20U\x27\x20R2\x20F\x20R\x20F\x27',
            'y\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'
        ],
        ['L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'],
        [
            'R\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27\x20R',
            'y\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20R\x20U\x27\x20R2\x20F\x20R\x20F\x27',
            'y\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'
        ]
    ],
    'F2L\x2028': [
        [
            'y\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x20L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F',
            'y\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F'
        ],
        [
            'y\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'y\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'y\x27\x20L\x27\x20U\x20L2\x20F\x27\x20L\x27\x20F',
            'L\x20U2\x20L\x20F\x27\x20L\x27\x20F\x20L\x27',
            'L\x20U\x20L\x27\x20U\x27\x20l\x20U\x20L\x27\x20U\x27\x20M\x27'
        ],
        ['R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R']
    ],
    'F2L\x2029': [
        [
            'R\x27\x20F\x20R\x20F\x27\x20U\x20R\x20U\x27\x20R\x27',
            'y\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'y\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'R\x27\x20F\x20R\x20F\x27\x20R\x27\x20F\x20R\x20F\x27'
        ],
        [
            'L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'U\x20F\x27\x20L\x20F\x20L2\x20U\x27\x20L'
        ],
        [
            'y\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'y\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'f\x27\x20L\x27\x20f\x20U\x20f\x27\x20L\x27\x20f'
        ],
        [
            'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'F2L\x203': [
        [
            'y\x27\x20R\x27\x20U\x27\x20R',
            'y\x20L\x27\x20U\x27\x20L',
            'F\x27\x20U\x27\x20F',
            'y\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        ['L\x27\x20U\x27\x20L'],
        [
            'y\x20R\x27\x20U\x27\x20R',
            'y\x27\x20L\x27\x20U\x27\x20L',
            'f\x27\x20L\x27\x20f',
            'y\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'R\x27\x20U\x27\x20R',
            'R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'F2L\x2030': [
        ['R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'],
        [
            'L\x20F\x27\x20L\x27\x20F\x20U\x27\x20L\x27\x20U\x20L',
            'y\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'U\x27\x20F\x20U\x27\x20R\x20U2\x20R\x27\x20F\x27',
            'y\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'L\x20F\x27\x20L\x27\x20F\x20L\x20F\x27\x20L\x27\x20F'
        ],
        ['L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'],
        [
            'y\x27\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'y\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'
        ]
    ],
    'F2L\x2031': [
        [
            'U\x27\x20R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27',
            'R\x20U\x27\x20R\x27\x20U\x20y\x27\x20R\x27\x20U\x20R',
            'R\x20U\x27\x20R\x27\x20U2\x20F\x20R\x27\x20F\x27\x20R',
            'R\x20U\x27\x20R\x20B\x27\x20R\x27\x20B\x20R\x27',
            'U\x20R\x20U2\x20R\x27\x20F\x27\x20U\x27\x20F'
        ],
        [
            'U\x20L\x20F\x27\x20L\x27\x20F\x20L\x27\x20U\x20L',
            'L\x27\x20U\x20L\x20U\x27\x20y\x20L\x20U\x27\x20L\x27',
            'L\x20F\x27\x20L\x27\x20F\x20U\x20L\x20F\x27\x20L\x27\x20F',
            'U\x27\x20L\x27\x20U\x20L\x20y\x27\x20U2\x20R\x27\x20F\x20R\x20F\x27',
            'U\x27\x20L\x27\x20U\x20L\x20y\x27\x20R\x20U2\x20R\x27'
        ],
        ['L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F\x20L\x27'],
        [
            'R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R',
            'R\x27\x20U\x20R\x20U\x27\x20y\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'F2L\x2032': [
        [
            'U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'U\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'y\x20U2\x20F\x20U\x27\x20R\x20U\x20R\x27\x20U\x20F\x27',
            'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'
        ],
        [
            'U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'U2\x20F\x20U\x27\x20R\x20U\x20R\x27\x20U\x20F\x27',
            'L2\x20U\x27\x20L2\x20U\x27\x20L2\x20U2\x20L2',
            'L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'
        ],
        [
            'U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U2\x20f\x20R\x27\x20U\x20R\x20U\x27\x20R\x20f\x27'
        ]
    ],
    'F2L\x2033': [
        [
            'U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'U\x27\x20D\x20R\x27\x20U\x27\x20R\x20D\x27',
            'U\x20D\x27\x20L\x27\x20U\x27\x20L\x20D',
            'U\x27\x20D\x27\x20R\x27\x20U\x27\x20R\x20D',
            'U\x20D\x20L\x27\x20U\x27\x20L\x20D\x27'
        ],
        [
            'D\x20R\x20U\x27\x20R\x27\x20D\x27',
            'D\x27\x20R\x20U\x27\x20R\x27\x20D',
            'U2\x20D\x27\x20L\x20U\x27\x20L\x27\x20D',
            'U2\x20D\x20L\x20U\x27\x20L\x27\x20D\x27',
            'R\x27\x20D\x20R\x20U\x27\x20R\x27\x20D\x27\x20R',
            'U\x27\x20L\x20D\x20L\x27\x20U\x20L\x20D\x27\x20L\x27',
            'U\x20L\x20D\x20L\x27\x20U\x27\x20L\x20D\x27\x20L\x27'
        ],
        [
            'U\x27\x20D\x20L\x27\x20U\x27\x20L\x20D\x27',
            'U\x20D\x27\x20R\x27\x20U\x27\x20R\x20D',
            'U\x27\x20D\x27\x20L\x27\x20U\x27\x20L\x20D',
            'U\x20D\x20R\x27\x20U\x27\x20R\x20D\x27',
            'U\x27\x20L\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27'
        ],
        [
            'D\x20L\x20U\x27\x20L\x27\x20D\x27',
            'D\x27\x20L\x20U\x27\x20L\x27\x20D',
            'U2\x20D\x27\x20R\x20U\x27\x20R\x27\x20D',
            'U2\x20D\x20R\x20U\x27\x20R\x27\x20D\x27',
            'U\x27\x20D\x27\x20R\x20U2\x20R\x27\x20D',
            'U\x27\x20D\x20R\x20U2\x20R\x27\x20D\x27',
            'U\x27\x20R\x20D\x20R\x27\x20U\x20R\x20D\x27\x20R\x27',
            'U\x20R\x20D\x20R\x27\x20U\x27\x20R\x20D\x27\x20R\x27'
        ]
    ],
    'F2L\x2034': [
        [
            'D\x27\x20L\x27\x20U\x20L\x20D',
            'U2\x20D\x20R\x27\x20U\x20R\x20D\x27',
            'U\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x20R\x27',
            'U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'U\x20R\x27\x20D\x27\x20R\x20U\x27\x20R\x27\x20D\x20R',
            'y\x27\x20U\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R',
            'y\x20U\x20L\x27\x20U\x20L\x20U2\x20L\x27\x20U\x20L'
        ],
        [
            'U\x27\x20D\x20R\x20U\x20R\x27\x20D\x27',
            'U\x20D\x27\x20L\x20U\x20L\x27\x20D',
            'U\x20L\x27\x20U\x20L\x20U2\x27\x20L\x27\x20U\x20L'
        ],
        [
            'D\x27\x20R\x27\x20U\x20R\x20D',
            'U2\x20D\x20L\x27\x20U\x20L\x20D\x27',
            'U\x20D\x20L\x27\x20U2\x20L\x20D\x27',
            'U\x20L\x20U\x20L\x27\x20U2\x20L\x20U\x20L\x27',
            'U\x20L\x27\x20D\x27\x20L\x20U\x27\x20L\x27\x20D\x20L',
            'U\x27\x20L\x27\x20D\x27\x20L\x20U\x20L\x27\x20D\x20L'
        ],
        [
            'U\x20D\x27\x20R\x20U\x20R\x27\x20D',
            'U\x27\x20D\x20L\x20U\x20L\x27\x20D\x27',
            'U\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U2\x27\x20R',
            'U\x20R\x27\x20U\x20R\x20U2\x27\x20R\x27\x20U\x20R'
        ]
    ],
    'F2L\x2035': [
        [
            'U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20R',
            'U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20R\x20U\x20R\x27\x20y\x20U\x20L\x27\x20U\x27\x20L',
            'U\x27\x20R\x20U\x20R\x27\x20U\x20F\x27\x20U\x27\x20F',
            'U2\x20R\x20U\x20R\x27\x20F\x20R\x27\x20F\x27\x20R',
            'U2\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x27\x20U\x27\x20F'
        ],
        [
            'y\x27\x20U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20R',
            'y\x27\x20U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x27\x20U\x27\x20R\x20U\x20R\x27\x20y\x20U\x20L\x27\x20U\x27\x20L',
            'U2\x20F\x20U\x20F\x27\x20U\x27\x20L\x27\x20U\x20L',
            'U\x27\x20F\x20U\x20F\x27\x20U\x20L\x27\x20U\x27\x20L',
            'U2\x20L\x20F\x27\x20L\x27\x20F\x20U2\x20L\x27\x20U\x27\x20L'
        ],
        [
            'U2\x20L\x20U\x20L\x27\x20U\x27\x20L\x20F\x20U\x20F\x27\x20L\x27',
            'U\x27\x20L\x20U\x20L\x27\x20U\x20f\x27\x20L\x27\x20f',
            'U\x27\x20L\x20F\x27\x20L\x20F\x20L\x27\x20U\x20L\x27',
            'U\x27\x20L\x20U\x20L\x27\x20y\x20U\x20R\x27\x20U\x27\x20R',
            'U\x27\x20L\x20U\x20L\x27\x20y\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U2\x20L\x20U\x20L\x27\x20y\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'y\x20U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20R',
            'y\x20U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20U\x27\x20R\x20U\x20R\x27\x20y\x20U\x20L\x27\x20U\x27\x20L',
            'U\x27\x20f\x20R\x20f\x27\x20U\x20R\x27\x20U\x27\x20R',
            'R\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U2\x20f\x20R\x20f\x27\x20U\x27\x20R\x27\x20U\x20R'
        ]
    ],
    'F2L\x2036': [
        [
            'y\x20U\x20L\x27\x20U\x27\x20L\x20y\x27\x20U\x27\x20R\x20U\x20R\x27',
            'y\x20U\x20L\x27\x20U\x27\x20L\x20y\x20U\x27\x20L\x20U\x20L\x27',
            'U\x20F\x27\x20U\x27\x20F\x20U\x27\x20R\x20U\x20R\x27',
            'U2\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20R\x20U\x20R\x27'
        ],
        [
            'U\x20L\x27\x20U\x27\x20L\x20y\x27\x20U\x27\x20R\x20U\x20R\x27',
            'U\x20L\x27\x20U\x27\x20L\x20y\x20U\x27\x20L\x20U\x20L\x27',
            'U2\x20L\x27\x20U\x20L\x20U\x20F\x20U\x20F\x27',
            'U2\x20L\x27\x20U\x27\x20L\x20F\x27\x20L\x20F\x20L\x27',
            'U\x20L\x27\x20U\x27\x20L\x20U\x27\x20F\x20U\x20F\x27'
        ],
        [
            'y\x20U\x20R\x27\x20U\x27\x20R\x20y\x20U\x27\x20R\x20U\x20R\x27',
            'y\x20U\x20R\x27\x20U\x27\x20R\x20y\x27\x20U\x27\x20L\x20U\x20L\x27',
            'U\x20f\x27\x20L\x27\x20f\x20U\x27\x20L\x20U\x20L\x27',
            'U2\x20f\x27\x20L\x27\x20f\x20U\x20L\x20U\x27\x20L\x27'
        ],
        [
            'U\x20R\x27\x20F\x20R\x27\x20F\x27\x20R\x20U\x27\x20R',
            'U\x20R\x27\x20U\x27\x20R\x20y\x20U\x27\x20R\x20U\x20R\x27',
            'U\x20R\x27\x20U\x27\x20R\x20y\x27\x20U\x27\x20L\x20U\x20L\x27',
            'U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20F\x27\x20U\x27\x20F\x20R',
            'U2\x20R\x27\x20U\x27\x20R\x20y\x20U\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'F2L\x2037': [
        [
            'R2\x20U2\x20F\x20R2\x20F\x27\x20U2\x20R\x27\x20U\x20R\x27',
            'R\x27\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'R\x27\x20F\x20R\x20F\x27\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R',
            'R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20y\x27\x20R\x27\x20U\x27\x20R',
            'R\x20U2\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20F\x27\x20U\x27\x20F'
        ],
        [
            'L2\x27\x20U2\x27\x20F\x27\x20L2\x27\x20F\x20U2\x27\x20L\x20U\x27\x20L',
            'L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20F\x20U\x20F\x27',
            'L\x20F\x27\x20L\x27\x20F\x20L\x20U2\x20L2\x27\x20U\x27\x20L2\x20U\x27\x20L\x27'
        ],
        [
            'L\x20U\x27\x20L\x27\x20F\x27\x20L\x27\x20U\x27\x20L2\x20U\x20L\x27\x20F',
            'L\x20U\x27\x20L\x27\x20l\x27\x20U2\x20L2\x20U\x20L2\x20U\x20l',
            'L\x20U2\x20L\x27\x20U\x20L\x20U2\x20L\x27\x20U\x20f\x27\x20L\x27\x20f'
        ],
        [
            'R\x27\x20U\x20R\x20r\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20r\x27',
            'R\x27\x20U\x20R\x20F\x20R\x20U\x20R2\x27\x20U\x27\x20R\x20F\x27'
        ]
    ],
    'F2L\x2038': [
        [
            'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'R2\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27',
            'R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'F\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20F'
        ],
        [
            'L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'L\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'F\x20U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20F\x27'
        ],
        [
            'L\x20U\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27'
        ],
        [
            'R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U2\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U2\x20R2'
        ]
    ],
    'F2L\x2039': [
        [
            'R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'R\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R2'
        ],
        [
            'L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U2\x27\x20L\x27\x20U\x20L',
            'L2\x20U2\x20L\x20U\x20L\x27\x20U\x20L\x20U2\x20L'
        ],
        [
            'L\x20U\x20L\x27\x20U2\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'L\x20U\x27\x20L\x27\x20U\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'
        ],
        [
            'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'R2\x20U2\x20R\x20U\x20R\x27\x20U\x20R\x20U2\x20R',
            'R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x27\x20R\x27\x20U\x20R',
            'R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R'
        ]
    ],
    'F2L\x204': [
        ['R\x20U\x20R\x27'],
        [
            'F\x20U\x20F\x27',
            'y\x20L\x20U\x20L\x27',
            'y\x27\x20R\x20U\x20R\x27'
        ],
        ['L\x20U\x20L\x27'],
        [
            'f\x20R\x20f\x27',
            'y\x20R\x20U\x20R\x27',
            'y\x27\x20L\x20U\x20L\x27'
        ]
    ],
    'F2L\x2040': [
        [
            'r\x20U\x27\x20r\x27\x20U2\x20r\x20U\x20r\x27\x20R\x20U\x20R\x27',
            'F\x27\x20L\x27\x20U2\x20L\x20F\x20R\x20U\x20R\x27',
            'R\x20F\x20U\x20R\x20U\x27\x20R\x27\x20F\x27\x20U\x27\x20R\x27'
        ],
        [
            'L\x27\x20U\x20L\x20F\x20R\x20U2\x27\x20R\x27\x20F\x27',
            'L\x27\x20U\x20L\x20l\x27\x20U\x20l\x20U2\x27\x20l\x27\x20U\x27\x20l',
            'F\x20U2\x27\x20R\x20U\x20R2\x27\x20F\x20R\x20F2\x27'
        ],
        [
            'l\x20U\x27\x20l\x27\x20U2\x20l\x20U\x20l\x27\x20L\x20U\x20L\x27',
            'L\x20U\x27\x20L\x20U\x20F\x20U\x27\x20F\x27\x20L2'
        ],
        [
            'R2\x20F\x27\x20U\x27\x20F\x20U\x20R\x20U\x27\x20R',
            'R\x27\x20F\x27\x20U2\x20F\x20R\x20f\x20R\x20f\x27',
            'R\x27\x20U\x20R\x20r\x27\x20U\x20r\x20U2\x20r\x27\x20U\x27\x20r'
        ]
    ],
    'F2L\x2041': [
        [
            'R\x20U\x27\x20R\x27\x20r\x20U\x27\x20r\x27\x20U2\x20r\x20U\x20r\x27',
            'R\x20U\x27\x20R\x27\x20F\x27\x20L\x27\x20U2\x20L\x20F',
            'R\x20U\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R\x27'
        ],
        [
            'l\x27\x20U\x20l\x20U2\x20l\x27\x20U\x27\x20l\x20L\x27\x20U\x27\x20L',
            'F\x20R\x20U2\x20R\x27\x20F\x27\x20L\x27\x20U\x27\x20L',
            'F2\x20R\x27\x20F\x27\x20R2\x20U\x27\x20R\x27\x20U2\x20F\x27'
        ],
        [
            'L\x20U\x27\x20L\x27\x20l\x20U\x27\x20l\x27\x20U2\x27\x20l\x20U\x20l\x27',
            'L\x20F\x20U2\x20F\x27\x20L\x27\x20f\x27\x20L\x27\x20f',
            'L2\x27\x20F\x20U\x20F\x27\x20U\x27\x20L\x27\x20U\x20L\x27'
        ],
        [
            'r\x27\x20U\x20r\x20U2\x20r\x27\x20U\x27\x20r\x20R\x27\x20U\x27\x20R',
            'f\x20R\x27\x20f\x27\x20R\x27\x20F\x27\x20U2\x27\x20F\x20R'
        ]
    ],
    'F2L\x205': [
        [
            'U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27',
            'U\x20L\x20U\x20L\x27\x20R\x20U\x27\x20R\x27'
        ],
        [
            'U\x20R\x27\x20F\x20L\x20F\x27\x20L\x27\x20F\x27\x20R',
            'U\x20R\x27\x20F\x20r\x20U\x27\x20r\x27\x20F\x27\x20R',
            'U\x20l\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20l',
            'y\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'U2\x20F\x20R\x20U\x20R\x27\x20U2\x20F\x27'
        ],
        [
            'U\x27\x20L\x20U\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27',
            'U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27',
            'U\x20R\x20U\x20R\x27\x20L\x20U\x27\x20L\x27'
        ],
        [
            'U\x27\x20R\x27\x20F\x20R\x20U\x20R\x27\x20U\x27\x20F\x27\x20R',
            'U\x20r\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20r',
            'R2\x20F\x27\x20U\x27\x20F\x20U\x20R2',
            'y\x20U\x27\x20R\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'F2L\x206': [
        [
            'U\x27\x20L\x20F\x27\x20R\x27\x20F\x20R\x20F\x20L\x27',
            'U\x27\x20r\x20U\x27\x20R\x27\x20U\x20R\x20U\x20r\x27',
            'y\x27\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R',
            'U2\x20F\x27\x20L\x27\x20U\x27\x20L\x20U2\x27\x20F',
            'y\x20U\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U\x20L',
            'y\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F'
        ],
        [
            'U\x20L\x27\x20U\x27\x20L\x20U2\x27\x20L\x27\x20U\x20L',
            'U\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F',
            'U\x27\x20R\x27\x20U\x27\x20R\x20L\x27\x20U\x20L',
            'F2\x20R\x20U\x20R\x27\x20U\x27\x20F2'
        ],
        [
            'U\x20r\x20U\x27\x20r\x27\x20U\x27\x20L\x20U\x20F\x20L\x27',
            'y\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R',
            'y\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R',
            'U\x27\x20l\x20U\x27\x20L\x27\x20U\x20L\x20U\x20l\x27',
            'y\x27\x20U\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U\x20L',
            'y\x27\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F'
        ],
        [
            'U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R',
            'U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R',
            'U2\x20R\x27\x20F\x27\x20U\x27\x20F\x20U2\x27\x20R'
        ]
    ],
    'F2L\x207': [
        [
            'U\x27\x20R\x20U2\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27',
            'U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27',
            'U\x20L\x20U2\x20L\x27\x20R\x20U\x27\x20R\x27'
        ],
        [
            'F\x20U\x20R\x20U2\x27\x20R\x27\x20U\x20F\x27',
            'y\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27',
            'y\x20U\x27\x20L\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27',
            'l\x20U2\x20L2\x20U\x27\x20L2\x20U\x27\x20l\x27'
        ],
        [
            'U\x27\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27',
            'U\x27\x20L\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27'
        ],
        [
            'y\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'y\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27',
            'y\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27',
            'r\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20r\x27',
            'F\x20R\x20U\x20R2\x27\x20U\x27\x20R\x20F\x27'
        ]
    ],
    'F2L\x208': [
        [
            'y\x27\x20U\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20R',
            'r\x27\x20U2\x20R2\x20U\x20R2\x27\x20U\x20r',
            'y\x20U\x20L\x27\x20U2\x20L\x20U2\x20L\x27\x20U\x20L',
            'y\x20U\x20L\x27\x20U2\x20L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F'
        ],
        [
            'U\x20L\x27\x20U2\x20L\x20U2\x27\x20L\x27\x20U\x20L',
            'U\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U2\x20L',
            'U\x20L\x27\x20U2\x20L\x20U\x27\x20L\x20F\x27\x20L\x27\x20F',
            'U\x20L\x27\x20U2\x20L\x20U2\x20L\x27\x20U\x20L'
        ],
        [
            'l\x27\x20U2\x20L2\x20U\x20L2\x20U\x20l',
            'y\x20U\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R',
            'y\x20U\x20R\x27\x20U2\x27\x20R\x20U2\x20R\x27\x20U\x20R',
            'U\x27\x20R\x27\x20U2\x20R\x20L\x27\x20U\x20L'
        ],
        [
            'U\x20R\x27\x20U2\x27\x20R\x20U\x20R\x27\x20U2\x27\x20R',
            'U\x20R\x27\x20U2\x27\x20R\x20U2\x20R\x27\x20U\x20R'
        ]
    ],
    'F2L\x209': [
        [
            'y\x27\x20R\x20U\x27\x20R2\x20U\x27\x20R',
            'U\x20y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U\x20y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U2\x20y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U2\x20y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20L\x20U\x27\x20L2\x20U\x27\x20L',
            'U2\x20y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U2\x20y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20R\x20U\x27\x20R\x27\x20U\x20F\x27\x20U\x27\x20F',
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20R',
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x20U\x20L\x27\x20U\x27\x20L',
            'U\x27\x20L\x27\x20U2\x20L\x20R\x27\x20U\x20R'
        ],
        [
            'L\x20U\x27\x20L2\x20U\x27\x20L',
            'U2\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'U\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U\x27\x20F\x20U\x27\x20F\x27\x20U\x20L\x27\x20U\x27\x20L',
            'U2\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'y\x20R\x20U\x27\x20R2\x20U\x27\x20R',
            'y\x27\x20L\x20U\x27\x20L2\x20U\x27\x20L',
            'U2\x20y\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'y\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'y\x20U2\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U2\x20y\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20U2\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20L\x20U\x27\x20L\x27\x20U\x20f\x27\x20L\x27\x20f'
        ],
        [
            'R\x20U\x27\x20R2\x20U\x27\x20R',
            'U2\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'U2\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U2\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'AF2L\x2010': [
        [
            'y\x20U\x27\x20L\x20U\x20L2\x20U\x27\x20L',
            'y\x27\x20U\x27\x20R\x20U\x20R2\x20U\x27\x20R'
        ],
        ['U\x27\x20L\x20U\x20L2\x27\x20U\x27\x20L'],
        [
            'y\x20U\x27\x20R\x20U\x20R2\x20U\x27\x20R',
            'y\x27\x20U\x27\x20L\x20U\x20L2\x20U\x27\x20L'
        ],
        ['U\x27\x20R\x20U\x20R2\x27\x20U\x27\x20R']
    ],
    'AF2L\x2010a': [
        [
            'U\x27\x20R\x27\x20D\x27\x20F\x27\x20D\x20R',
            'y\x27\x20U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20F',
            'U\x20L\x27\x20U2\x20L\x20y\x20U2\x20L\x27\x20U\x27\x20L'
        ],
        ['U\x27\x20F\x27\x20D\x27\x20L\x27\x20D\x20F'],
        ['y\x20U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20F'],
        ['U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20F']
    ],
    'AF2L\x2011': [
        ['U\x27\x20L\x20U\x27\x20L\x27\x20R\x20U\x27\x20R\x27'],
        [
            'U\x27\x20R\x27\x20U\x27\x20R\x20L\x27\x20U\x27\x20L',
            'y\x20U\x27\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20L\x27',
            'y\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20R\x20U\x27\x20R\x27'
        ],
        ['U\x27\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20L\x27'],
        [
            'U\x27\x20L\x27\x20U\x27\x20L\x20R\x27\x20U\x27\x20R',
            'U\x27\x20L\x27\x20U\x27\x20L\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x20L\x27\x20U2\x20L\x20U\x20R\x27\x20U\x27\x20R',
            'U\x20L\x27\x20U2\x20L\x20U\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20L',
            'y\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20L\x27',
            'y\x20U\x27\x20L\x20U\x27\x20L\x27\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x2011a': [
        [
            'U2\x20L\x20F\x27\x20U\x27\x20F\x20L\x27',
            'U\x27\x20L\x20U\x20L\x27\x20y\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U\x27\x20L\x20U\x20L\x27\x20y\x27\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U\x27\x20L\x20U\x20L\x27\x20y\x27\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'y\x20U2\x20L\x20U\x27\x20F\x27\x20U\x20F\x20L\x27',
            'y\x27\x20U2\x20L\x20F\x27\x20U\x27\x20F\x20L\x27',
            'U\x27\x20f\x20R\x20f\x27\x20U\x27\x20L\x27\x20U\x27\x20L'
        ],
        [
            'U2\x20L\x20U\x27\x20F\x27\x20U\x20F\x20L\x27',
            'U\x27\x20R\x20U\x20R\x27\x20y\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U\x27\x20R\x20U\x20R\x27\x20y\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20R\x20U\x20R\x27\x20y\x27\x20U\x27\x20L\x27\x20U\x27\x20L'
        ],
        ['U2\x20F\x20R\x27\x20U\x27\x20R\x20F\x27']
    ],
    'AF2L\x2012': [
        [
            'U\x27\x20R\x20U\x20R2\x20U\x27\x20R2\x20U\x20R\x27',
            'U2\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x20R\x27'
        ],
        [
            'U2\x20R\x20U\x20R\x27\x20L\x27\x20U\x20L',
            'U\x27\x20R\x20U\x20R2\x27\x20F\x20R\x20U\x20F\x27',
            'U\x27\x20R\x20U\x20R\x27\x20U2\x20L\x27\x20U\x27\x20L',
            'U2\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x27\x20L'
        ],
        [
            'U\x27\x20L\x20U\x20L2\x20U\x27\x20L2\x20U\x20L\x27',
            'U2\x20L\x20U2\x20L2\x20U\x27\x20L2\x20U\x20L\x27'
        ],
        [
            'U\x27\x20L\x20U\x20L\x27\x20U2\x20R\x27\x20U\x27\x20R',
            'U\x27\x20L\x20U\x20L\x27\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U2\x20L\x20U\x20L\x27\x20R\x27\x20U\x20R',
            'U2\x20L\x20U\x27\x20L\x27\x20R\x27\x20U\x27\x20R',
            'U2\x20L\x20U\x27\x20L\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'AF2L\x2012a': [
        [
            'U\x20R\x27\x20U2\x20R\x20y\x27\x20R\x27\x20U\x27\x20R',
            'U\x20R\x27\x20U2\x20R\x20y\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x20R\x27\x20U2\x20R\x20y\x20L\x27\x20U\x27\x20L'
        ],
        [
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x27\x20R\x20U2\x20R\x27',
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x20L\x20U2\x20L\x27'
        ],
        [
            'U\x27\x20L\x27\x20U\x27\x20L\x20y\x27\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U\x20L\x27\x20U2\x20L\x20y\x27\x20L\x27\x20U\x27\x20L',
            'U\x20L\x27\x20U2\x20L\x20y\x20R\x27\x20U\x27\x20R',
            'U\x20L\x27\x20U2\x20L\x20y\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U\x27\x20L\x20U\x27\x20L\x27\x20y\x27\x20L\x20U2\x20L\x27',
            'U\x27\x20L\x20U\x27\x20L\x27\x20y\x20R\x20U2\x20R\x27'
        ]
    ],
    'AF2L\x2013': [
        [
            'U\x27\x20L\x20F\x27\x20L2\x27\x20U\x20L\x20U2\x27\x20F',
            'U\x27\x20L\x20F\x27\x20L\x27\x20F\x20U2\x27\x20R\x20U\x20R\x27'
        ],
        ['y\x27\x20U\x27\x20L\x20F\x27\x20L\x27\x20F\x20U2\x20R\x20U\x20R\x27'],
        [
            'y\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R\x27\x20U\x27\x20R',
            'y\x20U\x20R\x27\x20F\x20R\x20F\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U\x20R\x27\x20F\x20R\x20F\x27\x20R\x27\x20U\x27\x20R',
            'U\x20R\x27\x20F\x20R\x20F\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'AF2L\x2014': [
        [
            'U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20R\x20U2\x20R\x27',
            'L\x20U\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x20R\x20U\x20R\x27',
            'U2\x20R2\x20u\x20R2\x27\x20u\x27\x20R2',
            'U2\x20R2\x20D\x20B2\x20D\x27\x20R2'
        ],
        [
            'R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20L\x27\x20U2\x20L',
            'U2\x20r2\x20U\x27\x20F2\x20U\x20r2',
            'U2\x20L2\x20D\x27\x20B2\x20D\x20L2',
            'U2\x20L2\x20u\x27\x20L2\x20u\x20L2'
        ],
        [
            'U2\x20r2\x20U\x20B2\x20U\x27\x20r2\x27',
            'U2\x20L2\x20u\x20L2\x20u\x27\x20L2',
            'y\x20U2\x20R2\x20u\x27\x20R2\x20u\x20R2',
            'U\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20L\x20U2\x20L\x27',
            'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20U\x27\x20U2\x20L\x20U\x20L\x27',
            'U2\x20L2\x27\x20D\x20F2\x20D\x27\x20L2'
        ],
        [
            'U2\x20R2\x20D\x27\x20F2\x20D\x20R2',
            'U2\x20R2\x27\x20u\x27\x20R2\x20u\x20R2',
            'U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20R\x27\x20U2\x20R',
            'L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R'
        ]
    ],
    'AF2L\x2015': [
        ['y\x20U\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20L\x27\x20U\x27\x20L'],
        [
            'U\x20R\x27\x20F\x20R\x20F\x27\x20U2\x20L\x27\x20U\x27\x20L',
            'U\x27\x20F\x20R\x27\x20F\x27\x20R\x20F\x20U\x20F\x27'
        ],
        ['U\x27\x20L\x20F\x27\x20L\x27\x20F\x20L\x20U\x20L\x27'],
        ['y\x27\x20U\x27\x20L\x20F\x27\x20L\x27\x20F\x20L\x20U\x20L\x27']
    ],
    'AF2L\x2016': [
        [
            'U\x27\x20R\x27\x20u\x27\x20R\x27\x20u\x20R',
            'U\x27\x20r\x27\x20D\x27\x20F\x27\x20D\x20r',
            'U\x27\x20R\x27\x20D\x27\x20F\x27\x20D\x20R'
        ],
        ['U\x27\x20F\x27\x20D\x27\x20L\x27\x20D\x20F'],
        [
            'U\x27\x20L\x27\x20u\x27\x20L\x27\x20u\x20L',
            'y\x27\x20U\x27\x20F\x27\x20D\x27\x20L\x27\x20D\x20F',
            'y\x20U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20F'
        ],
        ['U\x27\x20F\x27\x20R\x27\x20U\x27\x20R\x20F']
    ],
    'AF2L\x2017': [
        ['U2\x20L\x20F\x27\x20U\x27\x20F\x20L\x27'],
        ['U2\x20F\x20U\x27\x20R\x27\x20U\x20R\x20F\x27'],
        [
            'U2\x20R\x20B\x27\x20U\x27\x20B\x20R\x27',
            'y\x20U2\x20F\x20R\x27\x20U\x27\x20R\x20F\x27',
            'U\x27\x20R\x20U\x20R\x27\x20y\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U\x27\x20R\x20U\x20R\x27\x20y\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U2\x20F\x20R\x27\x20U\x27\x20R\x20F\x27',
            'U2\x20F\x20U\x20F\x27\x20R\x27\x20U2\x20R'
        ]
    ],
    'AF2L\x2018': [
        [
            'U\x27\x20R\x27\x20U\x27\x20R\x20y\x27\x20U\x27\x20R\x27\x20U\x27\x20R',
            'U\x27\x20R\x27\x20U\x27\x20R\x20y\x27\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20F\x27\x20U\x27\x20F',
            'U\x27\x20R\x27\x20U\x27\x20R\x20y\x20U\x27\x20L\x27\x20U\x27\x20L'
        ],
        [
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x27\x20R\x20U2\x20R\x27',
            'U\x27\x20R\x20U\x27\x20R\x27\x20y\x20L\x20U2\x20L\x27',
            'U\x27\x20R\x20U\x27\x20R\x27\x20F\x20U2\x27\x20F\x27',
            'U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20F\x20U\x27\x20F\x27'
        ],
        [
            'U\x27\x20F\x20U\x27\x20F\x27\x20L\x20U2\x20L\x27',
            'U\x20L\x27\x20U2\x20L\x20y\x27\x20L\x27\x20U\x27\x20L',
            'U\x20L\x27\x20U2\x20L\x20y\x20R\x27\x20U\x27\x20R',
            'U\x20L\x27\x20U2\x20L\x20y\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U\x27\x20L\x20U\x27\x20L\x27\x20y\x27\x20L\x20U2\x20L\x27'
        ],
        [
            'U\x27\x20L\x20U\x27\x20L\x27\x20y\x20R\x20U2\x20R\x27',
            'U\x27\x20L\x20U\x27\x20L\x27\x20y\x27\x20L\x20U2\x20L\x27',
            'U\x27\x20L\x20U\x27\x20L\x27\x20U\x27\x20f\x20R\x27\x20f\x27'
        ]
    ],
    'AF2L\x2019': [
        [
            'U\x20L\x27\x20U\x20L\x20y\x27\x20R\x27\x20U2\x20R',
            'U\x27\x20R\x20U\x20F\x20U\x27\x20F\x27\x20R\x27',
            'U\x20L\x27\x20U\x20L\x20y\x20L\x27\x20U2\x20L'
        ],
        [
            'U\x20L\x20U\x20L\x27\x20U\x20F\x20U\x20F\x27',
            'U\x27\x20L\x20U2\x20L\x27\x20y\x20L\x20U\x20L\x27',
            'U\x20L\x20U\x20L\x27\x20y\x20U\x20L\x20U\x20L\x27'
        ],
        [
            'U\x20R\x27\x20U\x20R\x20y\x20R\x27\x20U2\x27\x20R',
            'U\x20R\x27\x20U\x20R\x20y\x27\x20L\x27\x20U2\x20L',
            'U\x20R\x27\x20U\x20R\x20U\x20f\x27\x20L\x20f'
        ],
        [
            'U\x27\x20R\x20U2\x20R\x27\x20f\x20R\x20f\x27',
            'U\x27\x20R\x20U2\x20R\x27\x20y\x20R\x20U\x20R\x27',
            'U\x27\x20R\x20U2\x20R\x27\x20y\x27\x20L\x20U\x20L\x27',
            'U\x20R\x20U\x20R\x27\x20U\x20f\x20R\x20f\x27',
            'U\x20F\x27\x20U\x20F\x20R\x27\x20U2\x20R',
            'U\x20R\x20U\x20R\x27\x20U\x20y\x20R\x20U\x20R\x27'
        ]
    ],
    'AF2L\x202': [
        [
            'L\x20U\x27\x20L\x27\x20R\x20U2\x20R\x27',
            'L\x20U\x27\x20L\x27\x20U\x27\x20R\x20U\x27\x20R\x27'
        ],
        [
            'R\x27\x20U\x27\x20R\x20y\x27\x20R\x20U\x27\x20R\x27',
            'R\x27\x20U\x27\x20R\x20y\x20L\x20U\x27\x20L\x27',
            'F\x20R\x27\x20U2\x27\x20R\x20F\x27',
            'R\x27\x20U\x27\x20R\x20F\x20U\x27\x20F\x27'
        ],
        [
            'L\x20F\x27\x20U2\x20F\x20L\x27',
            'R\x20U\x27\x20R\x27\x20U\x27\x20L\x20U\x27\x20L\x27',
            'R\x20U\x27\x20R\x27\x20L\x20U2\x20L\x27',
            'F\x27\x20L\x20U2\x20L\x27\x20F'
        ],
        [
            'L\x27\x20U\x27\x20L\x20y\x27\x20L\x20U\x27\x20L\x27',
            'L\x27\x20U\x27\x20L\x20y\x20R\x20U\x27\x20R\x27',
            'L\x27\x20U\x27\x20L\x20f\x20R\x27\x20f\x27',
            'r\x27\x20U\x20F2\x20U\x27\x20r'
        ]
    ],
    'AF2L\x202a': [
        [
            'y\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R',
            'y\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20R\x27\x20U\x27\x20R\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U2\x20L\x20U\x27\x20L\x27\x20y\x20U2\x20L\x27\x20U\x27\x20L',
            'U2\x20L\x20U\x27\x20L\x27\x20y\x27\x20U2\x20R\x27\x20U\x27\x20R',
            'U2\x20L\x20U\x27\x20L\x27\x20y\x27\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        ['R\x27\x20U\x27\x20R\x20U\x27\x20L\x27\x20U\x27\x20L'],
        [
            'R\x27\x20F\x20R\x20F\x27\x20L\x20U2\x20L\x27',
            'R\x27\x20F\x20R\x20F\x27\x20U\x27\x20L\x20U\x27\x20L\x27'
        ],
        [
            'L\x27\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x27\x20L\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'AF2L\x2020': [
        [
            'U\x20L\x20U\x20L\x27\x20R\x20U\x20R\x27',
            'U\x27\x20L\x20U2\x20L\x27\x20U\x27\x20R\x20U\x20R\x27'
        ],
        ['U\x20R\x27\x20U\x20R\x20L\x27\x20U\x20L'],
        [
            'U\x20R\x20U\x20R\x27\x20L\x20U\x20L\x27',
            'U\x27\x20R\x20U2\x20R\x27\x20U\x27\x20L\x20U\x20L\x27'
        ],
        [
            'U\x20L\x27\x20U\x20L\x20R\x27\x20U\x20R',
            'y\x20R\x20U\x27\x20R\x27\x20L\x20U\x27\x20L\x27',
            'y\x27\x20L\x20U\x27\x20L\x27\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x2021': [
        [
            'U\x20F\x20D\x20R\x20D\x27\x20F\x27',
            'U\x20R\x27\x20U\x20R\x20U\x27\x20F\x27\x20U\x20F'
        ],
        [
            'U\x20R\x20F\x20U\x20F\x27\x20R\x27',
            'U\x20L\x20u\x20L\x20u\x27\x20L\x27',
            'U\x20L\x20D\x20F\x20D\x27\x20L\x27'
        ],
        ['U\x20F\x20L\x20U\x20L\x27\x20F\x27'],
        [
            'U\x20R\x20u\x20R\x20u\x27\x20R\x27',
            'U\x20L\x20U\x20L\x27\x20U\x27\x20f\x20R\x20f\x27',
            'U\x27\x20L\x20U2\x20L\x27\x20y\x27\x20U2\x20L\x20U\x20L\x27',
            'U\x20L\x20U\x20L\x27\x20y\x27\x20U\x27\x20L\x20U\x20L\x27'
        ]
    ],
    'AF2L\x2022': [
        [
            'R\x20L\x27\x20U2\x20L\x20R\x27',
            'L\x27\x20R\x20U2\x20R\x27\x20L',
            'F2\x20R\x27\x20F2\x20R'
        ],
        ['L\x20U\x27\x20L2\x20U\x20L'],
        [
            'L\x20R\x27\x20U2\x20R\x20L\x27',
            'R\x27\x20L\x20U2\x20L\x27\x20R'
        ],
        ['R\x20U\x27\x20R2\x27\x20U\x20R']
    ],
    'AF2L\x2023': [
        [
            'F\x27\x20L\x20U\x27\x20L\x27\x20F',
            'L\x20U\x27\x20L\x27\x20y\x27\x20U\x27\x20R\x27\x20U\x20R',
            'L\x20U\x27\x20L\x27\x20y\x20U\x27\x20L\x27\x20U\x20L'
        ],
        [
            'F\x20R\x27\x20U\x20R\x20F\x27',
            'R\x27\x20U\x20R\x20y\x27\x20U\x20R\x20U\x27\x20R\x27',
            'R\x27\x20U\x20R\x20y\x20U\x20L\x20U\x27\x20L\x27'
        ],
        [
            'L\x20F\x27\x20U\x20F\x20L\x27',
            'R\x20U2\x20R\x27\x20y\x20R\x27\x20U\x20R',
            'R\x20U2\x20R\x27\x20y\x27\x20L\x27\x20U\x20L',
            'R\x20U\x27\x20R\x27\x20y\x27\x20U\x27\x20L\x27\x20U\x20L'
        ],
        [
            'R\x27\x20F\x20U\x27\x20F\x27\x20R',
            'L\x27\x20U\x20L\x20y\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x27\x20U\x20L\x20y\x20U\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x2024': [
        ['R\x27\x20U\x20R2\x20U\x27\x20R\x27'],
        [
            'R\x20L\x27\x20U2\x20L\x20R\x27',
            'L\x27\x20R\x20U2\x20R\x27\x20L'
        ],
        ['L\x27\x20U\x20L2\x20U\x27\x20L\x27'],
        [
            'L\x20U\x27\x20L\x27\x20U2\x20R\x27\x20U\x20R',
            'R\x27\x20L\x20U2\x20L\x27\x20R',
            'L\x20R\x27\x20U2\x20R\x20L\x27'
        ]
    ],
    'AF2L\x2025': [
        [
            'F\x20R\x20U\x27\x20R2\x27\x20F\x27\x20R',
            'L\x20F\x27\x20L\x27\x20F\x20R\x20U\x27\x20R\x27'
        ],
        ['L\x20U\x20L\x27\x20y\x20L\x20U2\x20L\x27'],
        [
            'R\x27\x20U\x20R\x20y\x20U\x27\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U2\x20R\x20y\x20R\x27\x20U\x20R'
        ],
        [
            'F\x27\x20U\x20R\x27\x20U2\x20R\x20F',
            'R\x20U\x20R\x27\x20y\x27\x20L\x20U2\x20L\x27',
            'R\x20U\x27\x20R\x27\x20y\x20U\x27\x20R\x20U\x20R\x27',
            'R\x20U\x20R\x27\x20y\x20R\x20U2\x20R\x27'
        ]
    ],
    'AF2L\x2026': [
        [
            'L\x20R\x20U2\x27\x20R\x27\x20L\x27',
            'R\x20L\x20U2\x20L\x20R',
            'L\x20U\x20L\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'L\x20U\x27\x20L\x27\x20U2\x27\x20R\x20U\x20R\x27'
        ],
        [
            'L\x27\x20R\x27\x20U2\x20R\x20L',
            'R\x27\x20L\x27\x20U2\x20L\x20R',
            'R\x27\x20U\x27\x20R\x20U2\x20L\x27\x20U\x20L'
        ],
        [
            'L\x20R\x20U2\x27\x20R\x27\x20L\x27',
            'R\x20L\x20U2\x20L\x27\x20R\x27',
            'R\x20U\x20R\x27\x20U2\x20L\x20U\x27\x20L\x27'
        ],
        [
            'L\x27\x20U\x27\x20L\x20U\x20R\x27\x20U2\x20R',
            'L\x27\x20U\x20L\x20U2\x20R\x27\x20U\x27\x20R'
        ]
    ],
    'AF2L\x2027': [
        [
            'R\x27\x20U\x27\x20R\x20y\x27\x20R\x27\x20U2\x20R',
            'R\x27\x20U\x20R\x20y\x27\x20U\x20R\x27\x20U\x27\x20R',
            'F\x27\x20R\x27\x20U2\x20R\x20U\x27\x20F'
        ],
        [
            'R\x27\x20F\x20R2\x20U\x20R\x27\x20F\x27',
            'R\x20U2\x20R\x27\x20y\x20L\x20U\x27\x20L\x27',
            'R\x20U\x27\x20R\x27\x20y\x27\x20U\x20R\x20U\x20R\x27',
            'R\x20U\x27\x20R\x27\x20y\x20U\x20L\x20U\x20L\x27'
        ],
        [
            'L\x27\x20U\x27\x20L\x20y\x20R\x27\x20U2\x20R',
            'L\x27\x20U\x27\x20L\x20y\x27\x20L\x27\x20U2\x20L',
            'L\x27\x20U\x20L\x20y\x20U\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x20L\x20y\x27\x20U\x20L\x27\x20U\x27\x20L',
            'F\x20U\x27\x20L\x20U2\x20L\x27\x20F\x27'
        ],
        [
            'L\x20U\x27\x20L\x27\x20y\x27\x20U\x20L\x20U\x20L\x27',
            'L\x20U2\x20L\x27\x20y\x27\x20L\x20U\x27\x20L\x27',
            'L\x20U\x27\x20L\x27\x20y\x20U\x20R\x20U\x20R\x27',
            'L\x20U2\x20L\x27\x20y\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x2028': [
        ['L\x27\x20U\x20L\x20U\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'],
        [
            'L\x20U\x27\x20L2\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20L2\x20U\x27\x20L'
        ],
        ['R\x27\x20U\x20R\x20U\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'],
        [
            'R\x20U\x27\x20R2\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R2\x20U\x27\x20R'
        ]
    ],
    'AF2L\x2029': [
        [
            'L\x20U\x27\x20L\x27\x20y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'L\x20U\x27\x20L\x27\x20y\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'R\x27\x20U\x20R\x20y\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'R\x27\x20U\x20R\x20y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20y\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'R\x20U\x27\x20R\x27\x20y\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'L\x27\x20U\x20L\x20y\x27\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x27\x20U\x20L\x20y\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x203': [
        [
            'R\x27\x20U\x27\x20R2\x20U2\x20R\x27',
            'R\x27\x20U2\x20R2\x20U\x27\x20R\x27'
        ],
        [
            'R\x20U\x27\x20F\x20R\x27\x20U\x20R\x20F\x27\x20R\x27',
            'y\x20L\x27\x20U\x27\x20L2\x20U2\x20L\x27',
            'y\x27\x20R\x27\x20U2\x27\x20R2\x20U\x27\x20R\x27',
            'y\x27\x20R\x27\x20U\x27\x20R2\x20U2\x27\x20R\x27'
        ],
        [
            'L\x27\x20U\x27\x20L2\x20U2\x20L\x27',
            'L\x27\x20U2\x20L2\x20U\x27\x20L\x27'
        ],
        [
            'L\x20U\x27\x20L\x27\x20y\x27\x20U2\x20L\x20U\x27\x20L\x27',
            'L\x20U\x27\x20L\x27\x20y\x20U2\x20R\x20U\x27\x20R\x27',
            'L\x20U\x27\x20L\x27\x20y\x27\x20U\x27\x20L\x20U2\x20L\x27',
            'L\x20U\x27\x20L\x27\x20y\x20U\x20R\x20U2\x27\x20R\x27'
        ]
    ],
    'AF2L\x203a': [
        [
            'R\x27\x20U\x27\x20R\x20U2\x20F\x27\x20U\x27\x20F',
            'R\x27\x20U\x27\x20R\x20y\x20U2\x20L\x27\x20U\x27\x20L',
            'R\x27\x20U\x27\x20R\x20y\x27\x20U2\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U\x27\x20R\x20y\x27\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'U2\x20R\x20U\x27\x20R\x27\x20U\x20L\x27\x20U\x27\x20L',
            'F\x27\x20U\x27\x20F\x20U2\x20L\x27\x20U\x27\x20L'
        ],
        [
            'L\x27\x20U\x27\x20L\x20y\x27\x20U2\x20L\x27\x20U\x27\x20L',
            'L\x27\x20U\x27\x20L\x20y\x20U2\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x27\x20L\x20y\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'f\x27\x20L\x27\x20f\x20U2\x20R\x27\x20U\x27\x20R',
            'y\x27\x20L\x27\x20U\x27\x20L\x20y\x20U2\x20R\x27\x20U\x27\x20R',
            'y\x27\x20L\x27\x20U\x27\x20L\x20y\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x20R\x27\x20U\x27\x20R\x20y\x27\x20U2\x20R\x27\x20U\x27\x20R',
            'y\x20R\x27\x20U\x27\x20R\x20y\x27\x20U2\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ],
    'AF2L\x2030': [
        ['R\x27\x20U\x20R\x20U\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'],
        [
            'L\x20U\x27\x20L\x27\x20y\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27L',
            'L\x20U\x27\x20L\x27\x20y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R'
        ],
        [
            'R\x27\x20U\x20R\x20y\x27\x20R\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'R\x27\x20U\x20R\x20y\x20L\x20U\x20L\x27\x20U\x20L\x20U\x27\x20L\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20y\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'R\x20U\x27\x20R\x27\x20y\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ]
    ],
    'AF2L\x2031': [
        ['L\x27\x20U\x20L\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'],
        ['L\x20U\x27\x20L\x27\x20U\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L'],
        ['R\x27\x20U\x20R\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'],
        [
            'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R',
            'R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R'
        ]
    ],
    'AF2L\x2032': [
        [
            'L\x20U\x27\x20L\x27\x20y\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'L\x20U\x27\x20L\x27\x20y\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L'
        ],
        [
            'R\x27\x20U\x20R\x20y\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'R\x27\x20U\x20R\x20y\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20y\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'R\x20U\x27\x20R\x27\x20y\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L'
        ],
        [
            'L\x27\x20U\x20L\x20y\x27\x20L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'F\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U\x27\x20R\x20F\x27'
        ]
    ],
    'AF2L\x2033': [
        [
            'R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R2\x20U\x20R\x27',
            'R\x27\x20U\x20R2\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'R\x20U\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x27\x20L\x27\x20U\x27\x20L',
            'y\x27\x20R\x27\x20U\x20R2\x20U\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'y\x27\x20R\x27\x20U\x20R\x20U\x20R\x27\x20U\x20R2\x20U\x20R\x27',
            'y\x20L\x27\x20U\x20L2\x20U\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'y\x20L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L2\x20U\x20L\x27'
        ],
        [
            'L\x27\x20U\x20L2\x20U\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'L\x27\x20U\x20L\x20U\x20L\x27\x20U\x20L2\x20U\x20L\x27'
        ],
        ['L\x20U\x27\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20U\x20R']
    ],
    'AF2L\x2034': [
        [
            'L\x27\x20U\x20L\x20y\x27\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'L\x27\x20U\x27\x20L\x20y\x27\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x20L\x20y\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L'
        ],
        [
            'L\x20U\x20L\x27\x20y\x20U2\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20U\x20y\x20L\x20U\x27\x20L\x27'
        ],
        [
            'R\x27\x20U\x20R\x20y\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'R\x27\x20U\x27\x20R\x20y\x20U\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R'
        ],
        [
            'F\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20F',
            'R\x20U\x20R\x27\x20y\x20U2\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'R\x20U\x20R\x27\x20y\x27\x20U2\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'
        ]
    ],
    'AF2L\x2035': [
        [
            'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20R\x20U\x27\x20R\x27',
            'L\x20U\x20L\x27\x20U\x20R\x20U2\x20R\x27\x20U\x27\x20R\x20U\x20R\x27',
            'y\x27\x20L\x27\x20U\x20L\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'R\x27\x20U\x20R\x20U\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L',
            'R\x27\x20U\x27\x20R\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'y\x20R\x20U2\x20R\x27\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27',
            'y\x20R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20L\x20U\x27\x20L\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20L\x20U\x27\x20L\x27',
            'R\x20U\x20R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20L\x20U\x20L\x27',
            'R\x20U\x20R\x27\x20U\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'
        ],
        [
            'L\x27\x20U\x20L\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'L\x27\x20U\x27\x20L\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R'
        ]
    ],
    'AF2L\x2036': [
        [
            'R\x27\x20U\x20R2\x20U\x27\x20R2\x20F\x20R\x20F\x27\x20R\x20U\x27\x20R\x27',
            'R\x27\x20U2\x20R\x20y\x27\x20R\x27\x20U\x20R\x20U\x27\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U\x20R\x20y\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20y\x20L\x20U2\x20L\x27',
            'R\x27\x20F\x20R\x20F\x27\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x27\x20L',
            'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x20R\x27\x20y\x27\x20R\x20U2\x20R\x27'
        ],
        [
            'L\x27\x20U\x20L\x20y\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R',
            'L\x27\x20U\x20L\x20y\x27\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U\x20L'
        ],
        [
            'L\x20U\x27\x20L\x27\x20U\x27\x20L\x20U\x20L\x27\x20y\x27\x20L\x20U2\x20L\x27',
            'L\x20U\x20L\x27\x20y\x27\x20L\x20U2\x20L\x27\x20U\x27\x20L\x20U\x20L\x27'
        ]
    ],
    'AF2L\x2037': [
        [
            'F\x20U2\x20R\x20U\x27\x20R\x27\x20F\x27\x20U\x20R\x20U\x20R\x27',
            'L\x27\x20U\x27\x20L\x20y\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x27\x20L\x20y\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L\x20y\x27\x20R\x27\x20U2\x20R'
        ],
        [
            'L\x20U\x27\x20L\x27\x20y\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x20U\x20L\x27\x20y\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27'
        ],
        [
            'R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U2\x20R',
            'R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R'
        ],
        [
            'R\x20U\x27\x20R\x27\x20y\x27\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'R\x20U\x27\x20R\x27\x20y\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27',
            'R\x20U\x20R\x27\x20y\x27\x20U\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27'
        ]
    ],
    'AF2L\x2038': [
        [
            'L\x20U\x20L\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'L\x20U\x27\x20L\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U\x20R\x20U\x27\x20R\x27'
        ],
        [
            'R\x27\x20U\x20R\x20U\x20R\x27\x20U\x27\x20R\x20L\x27\x20U\x20L',
            'R\x27\x20U\x27\x20R\x20U\x27\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'R\x20U\x27\x20R\x27\x20U\x27\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'R\x20U\x27\x20R\x27\x20U\x20R\x20U2\x20R\x27\x20L\x20U2\x20L\x27',
            'R\x20U\x20R\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27'
        ],
        [
            'L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L\x20R\x27\x20U\x20R',
            'L\x27\x20U2\x20L\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R'
        ]
    ],
    'AF2L\x2039': [
        [
            'R\x27\x20U\x27\x20R\x20y\x27\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U\x20R\x20L\x20F\x27\x20R\x27\x20F\x20R\x20F\x20L\x27'
        ],
        [
            'R\x20U\x20R\x27\x20U\x27\x20y\x27\x20R\x20U\x27\x20R\x27\x20U\x20R\x20U\x20R\x27',
            'R\x20U\x20R\x27\x20y\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27',
            'R\x27\x20F\x20R\x20F\x27\x20U\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'F\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27\x20F\x27',
            'L\x27\x20U\x27\x20L\x20y\x20U2\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x27\x20L\x20y\x27\x20U2\x20L\x27\x20U2\x20L\x20U\x20L\x27\x20U\x27\x20L',
            'L\x27\x20U\x20L\x20U\x20L\x27\x20U\x27\x20L\x20y\x20U\x27\x20R\x27\x20U\x20R'
        ],
        [
            'L\x20U\x27\x20L\x27\x20y\x27U2\x20L\x20U2\x20L\x27\x20U\x20L\x20U\x27\x20L\x27',
            'L\x20U\x20L\x27\x20y\x27\x20U\x27\x20L\x20U\x27\x20L\x27\x20U\x20L\x20U\x20L\x27'
        ]
    ],
    'AF2L\x204': [
        [
            'U2\x20L\x27\x20U\x20L\x20U\x27\x20R\x20U\x20R\x27',
            'F\x20U\x20F\x27\x20U2\x27\x20R\x20U\x20R\x27',
            'y\x27\x20R\x20U\x20R\x27\x20U2\x20y\x20R\x20U\x20R\x27',
            'y\x20L\x20U\x20L\x27\x20y\x20U2\x20L\x20U\x20L\x27'
        ],
        [
            'L\x20U\x20L\x27\x20U2\x27\x20F\x20U\x20F\x27',
            'L\x20U\x20L\x27\x20y\x27\x20U2\x20R\x20U\x20R\x27',
            'L\x20U\x20L\x27\x20y\x20U2\x20L\x20U\x20L\x27'
        ],
        ['U2\x20R\x27\x20U\x20R\x20U\x27\x20L\x20U\x20L\x27'],
        [
            'R\x20U\x20R\x27\x20y\x27\x20U2\x20L\x20U\x20L\x27',
            'R\x20U\x20R\x27\x20y\x20U2\x20R\x20U\x20R\x27',
            'R\x20U\x20R\x27\x20U2\x27\x20f\x20R\x20f\x27'
        ]
    ],
    'AF2L\x204a': [
        [
            'U\x20L\x27\x20U\x20L\x20y\x20U2\x20L\x27\x20U\x20L',
            'U\x20L\x27\x20U\x20L\x20y\x27\x20U2\x20R\x27\x20U\x20R'
        ],
        [
            'U\x20L\x20U2\x20L2\x20U\x20L',
            'U\x20L\x20U\x20L2\x20U2\x20L'
        ],
        [
            'U\x20R\x27\x20U\x20R\x20y\x27\x20U2\x20L\x27\x20U\x20L',
            'U\x20R\x27\x20U\x20R\x20y\x20U\x20R\x27\x20U2\x20R',
            'U\x20R\x27\x20U\x20R\x20y\x20U2\x20R\x27\x20U\x20R'
        ],
        [
            'U\x20R\x20U2\x20R2\x20U\x20R',
            'U\x20R\x20U\x20R2\x20U2\x20R'
        ]
    ],
    'AF2L\x2040': [
        [
            'L\x27\x20U\x20L2\x20U2\x20L\x27\x20R\x20U\x27\x20R\x27',
            'L\x27\x20U\x27\x20L\x20R\x27\x20U2\x20R2\x20U\x20R\x27',
            'L\x27\x20U\x27\x20L\x20R\x27\x20U2\x20R2\x20U\x20R2\x20U\x20R'
        ],
        [
            'L\x20U\x27\x20L2\x20U2\x20L\x20U2\x20L\x27\x20U\x20L',
            'L\x20U\x27\x20L2\x20U2\x20L\x20U\x20L\x27\x20U2\x20L'
        ],
        [
            'R\x27\x20U\x20R\x20U2\x20L\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27',
            'R\x27\x20U\x20R2\x20U2\x20R\x27\x20L\x20U\x27\x20L\x27'
        ],
        [
            'R\x20U\x27\x20R2\x27\x20U2\x27\x20R\x20U2\x27\x20R\x27\x20U\x20R',
            'R\x20U\x27\x20R2\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x27\x20R'
        ]
    ],
    'AF2L\x2041': [
        [
            'L\x20U\x27\x20L2\x20U2\x20L\x20y\x27\x20R\x27\x20U2\x20R',
            'L\x20U\x27\x20L2\x20U2\x20L\x20y\x27\x20U\x20R\x27\x20U\x20R',
            'L\x20U\x27\x20L2\x20U2\x20L\x20y\x20L\x27\x20U2\x20L',
            'L\x20U\x27\x20L2\x20U2\x20L\x20y\x20U\x20L\x27\x20U\x20L',
            'L\x20U\x20L\x27\x20R\x20U2\x20R\x27\x20y\x27\x20U\x20R\x27\x20U\x27\x20R'
        ],
        [
            'R\x27\x20U\x20R2\x20U2\x20R\x27\x20y\x20L\x20U2\x20L\x27',
            'R\x27\x20U\x20R\x20y\x27\x20U\x20R\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'R\x27\x20U\x27\x20R\x20L\x27\x20U2\x20L\x20y\x20U\x27\x20L\x20U\x20L\x27'
        ],
        [
            'R\x20U\x27\x20R2\x20U2\x20R\x20y\x20R\x27\x20U2\x20R',
            'R\x20U\x27\x20R\x27\x20y\x20U\x27\x20R\x27\x20U2\x20R\x20U\x20R\x27\x20U2\x20R',
            'R\x20U\x27\x20R\x27\x20y\x20U\x27\x20R\x27\x20U2\x20R\x20U2\x20R\x27\x20U\x20R'
        ],
        [
            'F\x20U2\x20R\x20U2\x20R2\x20U\x27\x20R\x20F\x27',
            'L\x27\x20U\x20L2\x20U2\x20L\x27\x20y\x27\x20L\x20U2\x20L\x27'
        ]
    ],
    'AF2L\x2042': [
        [
            'R\x27\x20U\x27\x20R\x20U2\x20R\x27\x20U2\x20R2\x20U\x20R\x27',
            'R\x27\x20U\x20R2\x20U2\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'R\x27\x20U\x20R2\x20U2\x20R\x27\x20U\x20R\x27\x20F\x20R\x20F\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20U2\x20L\x27\x20U2\x20L\x20U2\x20L\x27\x20U\x20L',
            'y\x27\x20R\x27\x20U\x20R2\x20U2\x27\x20R\x27\x20U2\x20R\x20U\x27\x20R\x27',
            'y\x27\x20R\x27\x20U\x20R2\x20U2\x27\x20R\x27\x20U\x27\x20R\x20U2\x27\x20R\x27',
            'y\x20L\x27\x20U\x20L2\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27',
            'y\x20L\x27\x20U\x20L2\x20U2\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27'
        ],
        [
            'L\x27\x20U\x20L2\x20U2\x20L\x27\x20U\x27\x20L\x20U2\x20L\x27',
            'L\x27\x20U\x20L2\x20U2\x20L\x27\x20U2\x20L\x20U\x27\x20L\x27'
        ],
        [
            'L\x20U\x20L\x27\x20R\x20U2\x20R2\x20U\x27\x20R',
            'L\x20U\x27\x20L2\x20U2\x20L\x20R\x27\x20U\x20R',
            'L\x20U\x20L\x27\x20R\x20U2\x20R2\x20U\x27\x20R2\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x205': [
        ['L\x20U\x20L\x27\x20U\x20R\x20U\x20R\x27'],
        [
            'U2\x20R\x27\x20U\x20R\x20y\x27\x20U2\x20R\x20U\x20R\x27',
            'y\x20R\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27'
        ],
        ['R\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27'],
        [
            'y\x27\x20R\x20U\x20R\x27\x20U\x20L\x20U\x20L\x27',
            'L\x20F\x27\x20L\x27\x20F\x20R\x27\x20U2\x27\x20R'
        ]
    ],
    'AF2L\x205a': [
        [
            'U\x20L\x20U\x20L\x27\x20y\x20L\x27\x20U\x20L',
            'U\x20L\x20U\x20L\x27\x20y\x27\x20R\x27\x20U\x20R'
        ],
        [
            'y\x27\x20U\x20L\x27\x20U\x20L\x20R\x27\x20U2\x20R',
            'y\x20U\x20R\x27\x20U\x20R\x20L\x27\x20U2\x20L',
            'U\x20R\x27\x20U\x20R\x20L\x27\x20U2\x20L'
        ],
        ['U\x20R\x27\x20U\x20R\x20L\x27\x20U2\x20L'],
        [
            'U\x20R\x20U\x20R\x27\x20f\x27\x20L\x20f',
            'y\x20U\x20L\x27\x20U\x20L\x20R\x27\x20U2\x20R',
            'y\x27\x20U\x20R\x27\x20U\x20R\x20L\x27\x20U2\x20L'
        ]
    ],
    'AF2L\x206': [
        [
            'U2\x20R\x27\x20U\x20R\x20U\x20R\x20U\x20R\x27',
            'f\x20R\x20f\x27\x20R\x20U\x20R\x27'
        ],
        [
            'R\x20U\x20R\x27\x20y\x20L\x20U\x20L\x27',
            'R\x20U\x20R\x27\x20F\x20U\x20F\x27',
            'R\x20U\x20R\x27\x20y\x27\x20R\x20U\x20R\x27',
            'F\x20R\x27\x20F\x27\x20R\x20L\x27\x20U\x20L'
        ],
        [
            'U2\x20L\x27\x20U\x20L\x20U\x20L\x20U\x20L\x27',
            'L\x20F\x27\x20L\x27\x20F\x20y\x20R\x27\x20U\x20R',
            'F\x20U\x20F\x27\x20L\x20U\x20L\x27'
        ],
        [
            'L\x20U\x20L\x27\x20f\x20R\x20f\x27',
            'y\x20U2\x20R\x27\x20U\x20R\x20U\x20R\x20U\x20R\x27'
        ]
    ],
    'AF2L\x206a': [
        [
            'U\x20R\x27\x20U\x20R\x20y\x27\x20R\x27\x20U\x20R',
            'y\x27\x20U\x20L\x20R\x27\x20U\x20R\x20L\x27',
            'y\x20U\x20R\x20L\x27\x20U\x20L\x20R\x27',
            'U\x20S\x20R\x20S\x27'
        ],
        [
            'U\x20R\x20U\x20R\x27\x20U\x27\x20L\x27\x20U\x20L',
            'U\x20R\x20L\x27\x20U\x20L\x20R\x27'
        ],
        [
            'y\x20U\x20L\x20R\x27\x20U\x20R\x20L\x27',
            'y\x27\x20U\x20R\x20L\x27\x20U\x20L\x20R\x27',
            'U\x20S\x27\x20L\x20S',
            'U\x20L\x27\x20U\x20L\x20y\x27\x20L\x27\x20U\x20L',
            'U\x20L\x27\x20U\x20L\x20y\x20R\x27\x20U\x20R'
        ],
        [
            'U\x20L\x20R\x27\x20U\x20L\x27\x20R',
            'U\x20L\x20R\x27\x20U\x20R\x20L\x27'
        ]
    ],
    'AF2L\x207': [
        ['U\x27\x20L\x27\x20U\x20L\x20R\x20U\x27\x20R\x27'],
        ['y\x27\x20U\x27\x20L\x27\x20U\x20L\x20R\x20U\x27\x20R\x27'],
        [
            'U\x27\x20R\x27\x20U\x20R\x20L\x20U\x27\x20L\x27',
            'U\x27\x20R\x27\x20U\x27\x20R\x20L\x20U\x20L\x27'
        ],
        [
            'R\x20U\x27\x20R\x27\x20U\x27\x20R\x20U\x27\x20R\x27\x20f\x20R\x20f\x27',
            'y\x20U\x27\x20L\x27\x20U\x27\x20L\x20R\x20U\x20R\x27',
            'y\x20U\x27\x20L\x27\x20U\x20L\x20R\x20U\x27\x20R\x27'
        ]
    ],
    'AF2L\x207a': [
        [
            'y\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R',
            'y\x27\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R'
        ],
        [
            'U2\x20L\x20U\x27\x20L\x27\x20U\x20L\x27\x20U2\x20L',
            'U2\x20L\x20U\x27\x20L\x27\x20U2\x20L\x27\x20U\x20L'
        ],
        [
            'y\x20U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R',
            'y\x20U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R',
            'y\x27\x20U2\x20L\x20U\x27\x20L\x27\x20U2\x20L\x27\x20U\x20L'
        ],
        [
            'U2\x20R\x20U\x27\x20R\x27\x20U\x20R\x27\x20U2\x20R',
            'U2\x20R\x20U\x27\x20R\x27\x20U2\x20R\x27\x20U\x20R'
        ]
    ],
    'AF2L\x208': [
        [
            'y\x27\x20U\x27\x20L\x27\x20U\x20L\x20y\x27\x20L\x20U2\x20L\x27',
            'y\x20U\x27\x20R\x27\x20U\x20R\x20y\x27\x20R\x20U2\x20R\x27',
            'y\x20U\x27\x20R\x27\x20U\x20R\x20y\x20L\x20U2\x20L\x27',
            'y\x27\x20U\x27\x20L\x27\x20U\x20L\x20y\x20R\x20U2\x20R\x27',
            'R\x20D\x27\x20R\x27\x20U\x20R\x20U\x20D\x20R\x27',
            'U\x27\x20f\x27\x20L\x27\x20f\x20U\x27\x20R\x20U\x20R\x27'
        ],
        [
            'U\x27\x20R\x27\x20U\x20R\x20F\x20U2\x27\x20F\x27',
            'U\x27\x20R\x27\x20U2\x20F\x20U\x20F\x27\x20R'
        ],
        [
            'y\x20U\x27\x20L\x27\x20U\x20L\x20y\x27\x20L\x20U2\x20L\x27',
            'y\x27\x20U\x20R\x27\x20U2\x20R\x20F\x20U\x20F\x27',
            'y\x20U\x20L\x27\x20U2\x20L\x20f\x20R\x20f\x27',
            'U\x27\x20F\x27\x20U2\x20L\x20U\x20L\x27\x20F',
            'L\x20D\x27\x20L\x27\x20U\x20L\x20U\x20D\x20L\x27'
        ],
        [
            'U\x27\x20L\x27\x20U\x20L\x20y\x27\x20L\x20U2\x20L\x27',
            'F\x20U2\x20R\x20U\x20R2\x27\x20U\x27\x20R\x20F\x27',
            'U\x27\x20L\x27\x20U\x27\x20L\x20U\x27\x20f\x20R\x20f\x27',
            'U\x20L\x27\x20U2\x20L\x20f\x20R\x20f\x27'
        ]
    ],
    'AF2L\x208a': [
        [
            'U2\x20L\x20U\x27\x20L\x27\x20y\x27\x20R\x27\x20U2\x20R',
            'U2\x20L\x20U\x27\x20L\x27\x20y\x20L\x27\x20U2\x20L'
        ],
        [
            'y\x20U2\x20R\x20U\x27\x20R\x27\x20y\x20R\x27\x20U2\x20R',
            'U2\x20f\x20R\x20f\x27\x20U\x20L\x27\x20U\x27\x20L'
        ],
        [
            'U2\x20R\x20U\x27\x20R\x27\x20y\x20R\x27\x20U2\x20R',
            'U2\x20R\x20U\x27\x20R\x27\x20y\x27\x20L\x27\x20U2\x20L',
            'U2\x20R\x20U\x27\x20R\x27\x20U\x20f\x27\x20L\x20f'
        ],
        [
            'U2\x20F\x20U2\x20R\x27\x20U\x27\x20R\x20F\x27',
            'y\x27\x20U2\x20R\x20U\x27\x20R\x27\x20y\x20R\x27\x20U2\x20R',
            'y\x27\x20U2\x20R\x20U\x27\x20R\x27\x20y\x27\x20L\x27\x20U2\x20L',
            'y\x20U2\x20L\x20U\x27\x20L\x27\x20y\x20L\x27\x20U2\x20L'
        ]
    ],
    'AF2L\x209': [
        [
            'U\x20R\x27\x20U2\x27\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'U\x27\x20R\x27\x20U\x20R\x20U2\x27\x20R\x20U\x27\x20R\x27'
        ],
        [
            'y\x27\x20U\x20R\x27\x20U2\x20R\x20U\x27\x20R\x20U\x20R\x27',
            'y\x27\x20U\x27\x20R\x27\x20U\x27\x20R\x20U2\x20R\x20U\x20R\x27',
            'y\x20U\x27\x20L\x27\x20U\x20L\x20U\x27\x20L\x20U2\x20L\x27'
        ],
        ['U\x27\x20L\x27\x20U\x20L\x20U2\x20L\x20U\x27\x20L\x27'],
        ['y\x27\x20U\x27\x20L\x27\x20U\x20L\x20U2\x20L\x20U\x27\x20L\x27']
    ],
    'AF2L\x209a': [
        [
            'y\x27\x20U2\x20L\x20U\x27\x20L\x27\x20R\x27\x20U\x20R',
            'y\x20U2\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x20L'
        ],
        [
            'R\x20U2\x20R\x27\x20U\x27\x20L\x27\x20U\x27\x20L',
            'U2\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x20L'
        ],
        [
            'y\x27\x20U2\x20R\x20U\x27\x20R\x27\x20L\x27\x20U\x20L',
            'y\x20U2\x20L\x20U\x27\x20L\x27\x20R\x27\x20U\x20R'
        ],
        [
            'L\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20R',
            'L\x20U2\x20L\x27\x20U\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'U2\x20L\x20U\x27\x20L\x27\x20R\x27\x20U\x20R'
        ]
    ],
    'AF2L\x201': [
        [
            'L\x27\x20R\x20U\x27\x20R\x27\x20L',
            'L\x27\x20U\x27\x20L\x20U\x20R\x20U\x27\x20R\x27',
            'R\x20L\x27\x20U\x27\x20L\x20R\x27'
        ],
        [
            'y\x20L\x20R\x27\x20U\x27\x20R\x20L\x27',
            'y\x20R\x27\x20L\x20U\x27\x20L\x27\x20R',
            'y\x27\x20L\x27\x20R\x20U\x27\x20R\x27\x20L',
            'y\x27\x20R\x20L\x27\x20U\x27\x20L\x20R\x27',
            'L\x20U\x27\x20L\x27\x20y\x20L\x20U\x27\x20L\x27',
            'L\x20U\x27\x20L\x27\x20y\x27\x20R\x20U\x27\x20R\x27',
            'S\x27\x20L\x27\x20S'
        ],
        [
            'L\x20R\x27\x20U\x27\x20R\x20L\x27',
            'R\x27\x20L\x27\x20U\x27\x20L\x27\x20R'
        ],
        [
            'R\x20U\x27\x20R\x27\x20y\x20R\x20U\x27\x20R\x27',
            'y\x20R\x20L\x27\x20U\x27\x20L\x20R\x27',
            'y\x20L\x27\x20R\x20U\x27\x20R\x27\x20L',
            'y\x27\x20R\x27\x20L\x20U\x27\x20L\x27\x20R',
            'y\x27\x20L\x20R\x27\x20U\x27\x20R\x20L\x27',
            'S\x20R\x27\x20S\x27'
        ]
    ],
    'AF2L\x201a': [
        [
            'L\x27\x20U\x27\x20L\x20y\x20L\x27\x20U\x27\x20L',
            'L\x27\x20U\x27\x20L\x20y\x27\x20R\x27\x20U\x27\x20R',
            'L\x27\x20U\x27\x20L\x20y\x27\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'L\x27\x20U\x27\x20L\x20F\x27\x20U\x27\x20F'
        ],
        [
            'y\x20R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U\x27\x20R',
            'y\x20R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U\x27\x20F\x20R\x20F\x27',
            'y\x27\x20L\x27\x20U\x27\x20L\x20y\x20L\x27\x20U\x27\x20L',
            'f\x27\x20L\x27\x20f\x20L\x27\x20U\x27\x20L'
        ],
        [
            'R\x27\x20U\x27\x20R\x20f\x27\x20L\x27\x20f',
            'R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U\x27\x20R',
            'R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ],
        [
            'F\x27\x20U\x27\x20F\x20R\x27\x20U\x27\x20R',
            'y\x27\x20R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U\x27\x20R',
            'y\x27\x20R\x27\x20U\x27\x20R\x20y\x20R\x27\x20U\x27\x20F\x20R\x20F\x27'
        ]
    ]
};