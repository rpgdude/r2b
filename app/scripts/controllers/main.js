'use strict';

angular.module('r2bExpressApp')
    .controller('MainCtrl', function ($scope, socket) {

        // Socket listeners
        // ================

        socket.on('init', function (data) {
            $scope.name = data.name;
            $scope.language = data.language;
            $.each(data.users, function (index, user) {
                socket.emit('user:language', user, function (languageName) {
                    user.languageName = languageName;
                });
            });
            $scope.users = data.users;
            $scope.message = '';
        });

        socket.on('send:message', function (message) {
            if (message.language === $scope.language) {
                $scope.messages.push(message);
            } else {
                socket.emit('translate:message', message);
            }
        });

        socket.on('change:name', function (data) {
            changeName(data.oldName, data.newName);
        });

        socket.on('user:join', function (data) {
            $scope.messages.push({
                user: 'chatroom',
                text: 'User ' + data.name + ' has joined.'
            });
            $scope.users.push(data);
            socket.emit('user:language', data, function (languageName) {
                data.languageName = languageName;
            });
        });

        // add a message to the conversation when a user disconnects or leaves the room
        socket.on('user:left', function (data) {
            $scope.messages.push({
                user: 'chatroom',
                text: 'User ' + data.name + ' has left.'
            });
            var i, user;
            for (i = 0; i < $scope.users.length; i++) {
                user = $scope.users[i];
                if (user.name === data.name) {
                    $scope.users.splice(i, 1);
                    break;
                }
            }
        });

        // Private helpers
        // ===============

        var changeName = function (oldName, newName) {
            // rename user in list of users
            var i;
            for (i = 0; i < $scope.users.length; i++) {
                if ($scope.users[i].name === oldName) {
                    $scope.users[i].name = newName;
                }
            }

            $scope.messages.push({
                user: 'chatroom',
                text: 'User ' + oldName + ' is now known as ' + newName + '.'
            });
        }

        var scrollBottom = function () {
            $("#messages").animate({ scrollTop: $("#messages")[0].scrollHeight }, 1000);
        }

        // Methods published to the scope
        // ==============================

        $scope.changeName = function () {
            socket.emit('change:name', {
                name: $scope.newName
            }, function (result) {
                if (!result) {
                    alert('There was an error changing your name');
                } else {

                    changeName($scope.name, $scope.newName);

                    $scope.name = $scope.newName;
                    $scope.newName = '';
                }
            });
        };

        $scope.messages = [];

        $scope.$watch("messages.length", scrollBottom);

        $scope.sendMessage = function () {
            if ($scope.message === '') return;
            socket.emit('send:message', {
                message: $scope.message
            });

            // add the message to our model locally
            $scope.messages.push({
                user: $scope.name,
                text: $scope.message
            });

            // clear message box
            $scope.message = '';
        };
    });
