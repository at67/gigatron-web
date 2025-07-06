<?php

function parseIniMetadata($iniFile)
{
    $metadata = array();
    $content = file_get_contents($iniFile);

    if ($content !== false) {
        $lines = explode("\n", $content);
        foreach ($lines as $line) {
            $line = trim($line);

            // Skip empty lines, comments, and section headers
            if (empty($line) || $line[0] === '#' || $line[0] === '[') {
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

function formatFileSize($bytes)
{
    if ($bytes >= 1024) {
        return round($bytes / 1024, 1) . ' KB';
    }
    return $bytes . ' bytes';
}

function updateDownloadIni($iniFilePath, $downloadCount, $downloadedBy)
{
    // Read existing .ini content
    $iniContent = '';
    if (file_exists($iniFilePath)) {
        $iniContent = file_get_contents($iniFilePath);
    }

    // Remove existing downloads and downloaded_by lines
    $lines = explode("\n", $iniContent);
    $newLines = array();

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line && !str_starts_with($line, 'downloads=') && !str_starts_with($line, 'downloaded_by=')) {
            $newLines[] = $line;
        }
    }

    // Add updated download tracking
    $newLines[] = 'downloads=' . $downloadCount;
    $newLines[] = 'downloaded_by=' . implode(',', $downloadedBy);

    // Write back to file with file locking
    $newContent = implode("\n", $newLines) . "\n";
    file_put_contents($iniFilePath, $newContent, LOCK_EX);
}

function scanGT1s($root_path)
{
    $gt1s = array();
    $gt1Path = $root_path . 'ext/at67/gigatronemulator/gt1/';

    if (is_dir($gt1Path)) {
        $categories = scandir($gt1Path);
        foreach ($categories as $category) {
            if ($category === '.' || $category === '..') continue;

            $categoryPath = $gt1Path . $category . '/';
            if (is_dir($categoryPath)) {
                $authors = scandir($categoryPath);
                foreach ($authors as $author) {
                    if ($author === '.' || $author === '..') continue;

                    $authorPath = $categoryPath . $author . '/';
                    if (is_dir($authorPath)) {
                        $files = scandir($authorPath);
                        foreach ($files as $file) {
                            if ($file === '.' || $file === '..') continue;

                            $filePath = $authorPath . $file;

                            if (is_dir($filePath)) {
                                // Check subdirectory for gt1 files (like at67/Invader/)
                                $subFiles = scandir($filePath . '/');
                                foreach ($subFiles as $subFile) {
                                    if (pathinfo($subFile, PATHINFO_EXTENSION) === 'gt1') {
                                        $gt1s[] = array(
                                            'filename' => $subFile,
                                            'author' => $author,
                                            'category' => $category,
                                            'path' => $category . '/' . $author . '/' . $file . '/' . $subFile,
                                            'title' => pathinfo($subFile, PATHINFO_FILENAME),
                                        );
                                    }
                                }
                            } elseif (pathinfo($file, PATHINFO_EXTENSION) === 'gt1') {
                                // Direct gt1 file in author folder (like delpozzo/)
                                $gt1s[] = array(
                                    'filename' => $file,
                                    'author' => $author,
                                    'category' => $category,
                                    'path' => $category . '/' . $author . '/' . $file,
                                    'title' => pathinfo($file, PATHINFO_FILENAME),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    return $gt1s;
}
