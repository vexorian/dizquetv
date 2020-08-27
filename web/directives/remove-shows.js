module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/remove-shows.html',
        replace: true,
        scope: {
            programTitles: "=programTitles",
            visible: "=visible",
            onDone: "=onDone",
            deleted: "=deleted"
        },
        link: function (scope, element, attrs) {
            scope.toggleShowDeletion = (programTitle) => {
                const deletedIdx = scope.deleted.indexOf(programTitle);
                if (deletedIdx === -1) {
                    scope.deleted.push(programTitle);
                } else {
                    scope.deleted.splice(deletedIdx, 1);
                }
            }
            scope.finished = () => {
                const d = scope.deleted;
                scope.programTitles = null;
                scope.deleted = null;
                scope.onDone(d);
            }
        }
    };
}
