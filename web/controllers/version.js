module.exports = function ($scope, dizquetv) {
    $scope.version = "Getting dizqueTV version..."
    $scope.ffmpegVersion = "Getting ffmpeg version..."
    dizquetv.getVersion().then((version) => {
        $scope.version = version.dizquetv;
        $scope.ffmpegVersion = version.ffmpeg;
    })

    
}