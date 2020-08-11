module.exports = function ($scope, dizquetv) {
    $scope.version = "Getting dizqueTV version..."
    dizquetv.getVersion().then((version) => {
        $scope.version = version.dizquetv
    })

    
}