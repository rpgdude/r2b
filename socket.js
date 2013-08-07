var MsTranslator = require("mstranslator");

// TODO: Submit patch upstream
// Fixes bug in MsTranslator exception handling
var querystring = require("querystring");
var http = require("http");
MsTranslator.prototype.call = function(path, params, fn) {
    var settings = this.mstrans;
    settings.headers.Authorization = 'Bearer ' + this.access_token;
    params = this.convertArrays(params);
    settings.path= this.ajax_root + path + '?' + querystring.stringify(params);
    var req = http.request(settings, function(res) {
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
      //remove invalid BOM
            body = body.substring(1, body.length);
            try {
                if (/^.\w*Exception:/.test(body)) {
                    fn(body, JSON.parse(body));
                } else {
                    fn(null, JSON.parse(body));
                }
            } catch (e) {
                fn(e, null);
            }
        });
    });
    req.end();
};

var client_secret = process.env.MSCLIENT_SECRET;
var client_id = process.env.MSCLIENT_ID;

if (!client_secret || !client_id) {
    console.log("client_secret and client_id missing");
    process.exit(1);
}

var client = new MsTranslator({ client_id: client_id, client_secret: client_secret });

// Keep track of which names are used so that there are no duplicates
var userNames = (function () {
    var names = {};

    var claim = function (name, language) {
        if (!name || names[name]) {
            return false;
        } else {
            names[name] = language;
            return true;
        }
    };

    // find the lowest unused "guest" name and claim it
    var getGuestName = function (language) {
        var name,
        nextUserId = 1;

        do {
            name = 'Guest ' + nextUserId;
            nextUserId += 1;
        } while (!claim(name, language));

        return name;
    };

    // serialize claimed names as an array
    var get = function () {
        var res = [];
        for (user in names) {
            var language = names[user];
            res.push({ name: user, language: language, languageName: 'Loading...' });
        }

        return res;
    };

    var free = function (name) {
        if (names[name]) {
            delete names[name];
        }
    };

    return {
        claim: claim,
        free: free,
        get: get,
        getGuestName: getGuestName
    };
}());

// export function for listening to the socket
module.exports = function (socket) {
    var language = socket.handshake.language;
    var name = userNames.getGuestName(language);

    // send the new user their name and a list of users
    socket.emit('init', {
        name: name,
        users: userNames.get(),
        language: language
    });

    // notify other clients that a new user has joined
    socket.broadcast.emit('user:join', {
        name: name,
        language: language,
        languageName: 'Loading...'
    });

    socket.on('user:language', function (data, fn) {
        var languageCode = data.language;
        var languageName = 'Unknown';
        var params = { locale: language, languageCodes: [ languageCode] };
        client.initialize_token( function () {
            client.getLanguageNames(params, function (err, data) {
                if (err) {
                    console.error(err);
                } else if (data && data[0]) {
                    languageName = data[0];
                }
                fn(languageName);
            });
        });
    });

    // broadcast a user's message to other users
    socket.on('send:message', function (data) {
        socket.broadcast.emit('send:message', {
            user: name,
            text: data.message,
            language: language
        });
    });

    // translate a user's message
    socket.on('translate:message', function (data) {
        var user = data.user;
        var text = data.text;
        var params = { text: text, from: data.language, to: language };
        client.initialize_token( function () {
            client.translate(params, function (err, data) {
                if (err) {
                    console.error(err);
                } else {
                    text = data;
                }
                socket.emit('send:message', { user: user, text: text, language: language});
            });
        });
    });

    // validate a user's name change, and broadcast it on success
    socket.on('change:name', function (data, fn) {
        if (userNames.claim(data.name, language)) {
            var oldName = name;
            userNames.free(oldName);

            name = data.name;

            socket.broadcast.emit('change:name', {
                oldName: oldName,
                newName: name
            });

            fn(true);
        } else {
            fn(false);
        }
    });

    // clean up when a user leaves, and broadcast it to other users
    socket.on('disconnect', function () {
        socket.broadcast.emit('user:left', {
            name: name
        });
        userNames.free(name);
    });
};
