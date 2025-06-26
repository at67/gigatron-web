<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$type = $_GET['type'] ?? 'rom';

if ($type === 'rom') {
    $directory = '../roms/';
    $extensions = ['rom'];
} elseif ($type === 'gt1') {
    $directory = '../gt1/';
    $extensions = ['gt1'];
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type parameter']);
    exit;
}

function scanDirectory($dir, $basePath = '', $extensions = []) {
    $files = [];

    if (!is_dir($dir)) {
	return $files;
    }

    $items = scandir($dir);

    foreach ($items as $item) {
	if ($item === '.' || $item === '..') {
	    continue;
	}

	$fullPath = $dir . $item;
	$relativePath = $basePath ? $basePath . '/' . $item : $item;

	if (is_dir($fullPath)) {
	    // Recursively scan subdirectories
	    $subFiles = scanDirectory($fullPath . '/', $relativePath, $extensions);
	    $files = array_merge($files, $subFiles);
	} elseif (is_file($fullPath)) {
	    // Check if file has valid extension
	    $pathInfo = pathinfo($item);
	    $extension = strtolower($pathInfo['extension'] ?? '');

	    if (in_array($extension, $extensions)) {
		$fileInfo = [
		    'filename' => $item,
		    'path' => $relativePath,
		    'size' => filesize($fullPath),
		    'modified' => filemtime($fullPath),
		    'extension' => $extension
		];

		// Load metadata if available
		$metaPath = $fullPath . '.meta';
		if (file_exists($metaPath)) {
		    $metadata = parseMetadata($metaPath);
		    $fileInfo = array_merge($fileInfo, $metadata);
		}

		// Set defaults for missing metadata
		$fileInfo['title'] = $fileInfo['title'] ?? $pathInfo['filename'];
		$fileInfo['author'] = $fileInfo['author'] ?? 'Unknown';
		$fileInfo['category'] = $fileInfo['category'] ?? 'Uncategorized';
		$fileInfo['language'] = $fileInfo['language'] ?? 'Unknown';
		$fileInfo['description'] = $fileInfo['description'] ?? '';

		$files[] = $fileInfo;
	    }
	}
    }

    return $files;
}

function parseMetadata($metaPath) {
    $metadata = [];
    $content = file_get_contents($metaPath);

    if ($content !== false) {
	$lines = explode("\n", $content);
	foreach ($lines as $line) {
	    $line = trim($line);

	    // Skip empty lines and comments
	    if (empty($line) || $line[0] === '#') {
		continue;
	    }

	    // Parse key=value pairs
	    $parts = explode('=', $line, 2);
	    if (count($parts) === 2) {
		$key = trim($parts[0]);
		$value = trim($parts[1]);
		$metadata[$key] = $value;
	    }
	}
    }

    return $metadata;
}

try {
    $files = scanDirectory($directory, '', $extensions);

    // Sort files by name by default
    usort($files, function($a, $b) {
	return strcasecmp($a['filename'], $b['filename']);
    });

    echo json_encode($files);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to scan directory: ' . $e->getMessage()]);
}
?>
