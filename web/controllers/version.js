module.exports = function ($scope, pseudotv) {
    $scope.version = "Getting PseudoTV version..."
    pseudotv.getVersion().then((version) => {
        $scope.version = version.pseudotv
    })

    
}