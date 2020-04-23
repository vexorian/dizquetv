module.exports = function ($rootScope, $scope, pseudotv, plex, $location) {
    $scope.selected = $location.hash()
    if ($scope.selected === '')
        $scope.selected = 'xmltv'
}