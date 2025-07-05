<?php
namespace at67\gigatronshowcase\controller;

class content
{
    protected $root_path;

    public function __construct($root_path)
    {
        $this->root_path = $root_path;
    }

    public function scanRoms()
    {
        $roms = array();
        $romsPath = $this->root_path . 'ext/at67/gigatronemulator/roms/';

        if (is_dir($romsPath)) {
            $files = scandir($romsPath);
            foreach ($files as $file) {
                if ($file === '.' || $file === '..' || strpos($file, ':Zone.Identifier') !== false) continue;

                if (pathinfo($file, PATHINFO_EXTENSION) === 'rom') {
                    $romData = array(
                        'filename' => $file,
                        'path' => $file,
                        'title' => pathinfo($file, PATHINFO_FILENAME),
                        'author' => 'Unknown',
                        'version' => '',
                        'description' => '',
                        'features' => '',
                    );

                    // Check for .ini metadata file
                    $iniFile = $romsPath . pathinfo($file, PATHINFO_FILENAME) . '.ini';
                    if (file_exists($iniFile)) {
                        $metadata = $this->parseIniMetadata($iniFile);
                        $romData = array_merge($romData, $metadata);
                    }

                    // Check for ROM screenshot
                    $screenshotFilename = str_replace('.rom', '.png', $file);
                    $screenshotPath = $romsPath . $screenshotFilename;
                    $screenshotExists = file_exists($screenshotPath);
                    $romData['screenshot_exists'] = $screenshotExists;
                    $romData['screenshot_url'] = $screenshotExists ? '/ext/at67/gigatronemulator/roms/' . $screenshotFilename . '?' . filemtime($screenshotPath) : null;

                    $roms[] = $romData;
                }
            }
        }

        // Order ROMs according to roms.ini
        $romOrder = $this->getRomOrder();
        if (!empty($romOrder)) {
            $orderedRoms = array();
            $remainingRoms = array();

            // First add ROMs in specified order
            foreach ($romOrder as $order => $filename) {
                foreach ($roms as $rom) {
                    if ($rom['filename'] === $filename) {
                        $orderedRoms[] = $rom;
                        break;
                    }
                }
            }

            // Then add any remaining ROMs not in the order file
            foreach ($roms as $rom) {
                if (!in_array($rom['filename'], $romOrder)) {
                    $remainingRoms[] = $rom;
                }
            }

            $roms = array_merge($orderedRoms, $remainingRoms);
        }

        return $roms;
    }

    public function scanGT1s()
    {
        $gt1s = array();
        $gt1Path = $this->root_path . 'ext/at67/gigatronemulator/gt1/';

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

    public function parseIniMetadata($iniFile)
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

    public function addScreenshotInfo($gt1)
    {
        // Check if screenshot exists for this GT1
        $gt1Path = $this->root_path . 'ext/at67/gigatronemulator/gt1/';
        $fullFilePath = $gt1Path . $gt1['path'];
        $screenshotFilename = str_replace('.gt1', '.png', basename($gt1['path']));
        $screenshotPath = dirname($fullFilePath) . '/' . $screenshotFilename;
        $screenshotExists = file_exists($screenshotPath);
        $gt1['screenshot_exists'] = $screenshotExists;
        $gt1['screenshot_url'] = $screenshotExists ? '/ext/at67/gigatronemulator/gt1/' . dirname($gt1['path']) . '/' . $screenshotFilename . '?' . filemtime($screenshotPath) : null;

        return $gt1;
    }

    public function getCategoryOrder()
    {
        $categoryOrderFile = $this->root_path . 'ext/at67/gigatronemulator/gt1/categories.ini';
        $categoryOrder = array();

        if (file_exists($categoryOrderFile)) {
            $iniData = parse_ini_file($categoryOrderFile);
            if ($iniData !== false) {
                ksort($iniData);
                $categoryOrder = array_values($iniData);
            }
        }

        return $categoryOrder;
    }

    public function getRomOrder()
    {
        $romOrderFile = $this->root_path . 'ext/at67/gigatronemulator/roms/roms.ini';
        $romOrder = array();

        if (file_exists($romOrderFile)) {
            $iniData = parse_ini_file($romOrderFile);
            if ($iniData !== false) {
                ksort($iniData);
                foreach ($iniData as $order => $filename) {
                    $romOrder[(int)$order] = $filename;
                }
            }
        }

        return $romOrder;
    }

    public function formatFileSize($bytes)
    {
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return $bytes . ' bytes';
    }
}
