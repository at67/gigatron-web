<?php
namespace at67\gigatronshowcase\controller;

class rom
{
    protected $helper;
    protected $template;
    protected $user;
    protected $root_path;

    public function __construct(\phpbb\controller\helper $helper, \phpbb\template\template $template, \phpbb\user $user, $root_path)
    {
        $this->helper = $helper;
        $this->template = $template;
        $this->user = $user;
        $this->root_path = $root_path;
    }

    public function rom($filename)
    {
        // Find the specific ROM
        $roms = $this->scanRoms();
        $selectedRom = null;

        foreach ($roms as $rom) {
            if ($rom['filename'] === $filename) {
                $selectedRom = $rom;
                break;
            }
        }

        if (!$selectedRom) {
            throw new \phpbb\exception\http_exception(404, 'ROM not found');
        }

        // Check for ROM screenshot (similar to GT1 logic)
        $romsPath = $this->root_path . 'ext/at67/gigatronemulator/roms/';
        $screenshotFilename = str_replace('.rom', '.png', $selectedRom['filename']);
        $screenshotPath = $romsPath . $screenshotFilename;
        $screenshotExists = file_exists($screenshotPath);
        $screenshotUrl = $screenshotExists ? '/ext/at67/gigatronemulator/roms/' . $screenshotFilename . '?' . filemtime($screenshotPath) : null;

        // Calculate file size
        $romFilePath = $romsPath . $selectedRom['filename'];
        if (file_exists($romFilePath)) {
            $fileSize = filesize($romFilePath);
            $selectedRom['filesize'] = $this->formatFileSize($fileSize);
        }

        // Ensure required metadata fields are set with defaults
        if (!isset($selectedRom['description'])) {
            $selectedRom['description'] = 'No description available.';
        }
        if (!isset($selectedRom['downloads'])) {
            $selectedRom['downloads'] = '0';
        }
        if (!isset($selectedRom['date'])) {
            $selectedRom['date'] = 'Unknown';
        }

        $this->template->assign_vars(array(
        'ROM' => $selectedRom,
        'SCREENSHOT_EXISTS' => $screenshotExists,
        'SCREENSHOT_URL' => $screenshotUrl,
        'IS_ADMIN' => $this->checkAdminPermission(),
        'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
        'U_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
        'U_EMULATOR_SCREENSHOT' => $this->helper->route('at67_gigatronemulator_main') . '?autoload_rom=' . urlencode($selectedRom['filename']) . '&screenshot_mode=1',
        ));

        return $this->helper->render('gigatronshowcase_rom.html', $selectedRom['title'] . ' - ROM Details');
    }

    public function downloadTrackerRom($filename)
    {
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');

        // Check if user is logged in
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Get username
        $user = $phpbb_container->get('user');
        $username = $user->data['username'];

        // Validate filename - prevent directory traversal
        if (strpos($filename, '..') !== false || strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
            throw new \phpbb\exception\http_exception(400, 'Invalid filename');
        }

        // Check if ROM file exists
        $romsPath = $this->root_path . 'ext/at67/gigatronemulator/roms/';
        $romFilePath = $romsPath . $filename;

        if (!file_exists($romFilePath)) {
            throw new \phpbb\exception\http_exception(404, 'ROM file not found');
        }

        // Check/update download tracking in .ini file
        $iniFilename = str_replace('.rom', '.ini', $filename);
        $iniFilePath = $romsPath . $iniFilename;

        $downloadCount = 0;
        $downloadedBy = array();

        // Read existing .ini file if it exists
        if (file_exists($iniFilePath)) {
            $iniData = $this->parseIniMetadata($iniFilePath);
            $downloadCount = isset($iniData['downloads']) ? (int)$iniData['downloads'] : 0;

            if (isset($iniData['downloaded_by'])) {
                $downloadedBy = array_map('trim', explode(',', $iniData['downloaded_by']));
            }
        }

        // Check if this user has already downloaded this file
        if (!in_array($username, $downloadedBy)) {
            // New user download - increment counter and add to list
            $downloadCount++;
            $downloadedBy[] = $username;

            // Update .ini file
            $this->updateRomDownloadIni($iniFilePath, $downloadCount, $downloadedBy);
        }

        // Serve the file
        $response = new \Symfony\Component\HttpFoundation\BinaryFileResponse($romFilePath);
        $response->setContentDisposition(
            \Symfony\Component\HttpFoundation\ResponseHeaderBag::DISPOSITION_ATTACHMENT,
            $filename
        );

        return $response;
    }

    private function updateRomDownloadIni($iniFilePath, $downloadCount, $downloadedBy)
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

    private function formatFileSize($bytes)
    {
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return $bytes . ' bytes';
    }

    private function parseIniMetadata($iniFile)
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

    private function getRomOrder()
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

    private function scanRoms()
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

    private function checkAdminPermission()
    {
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        return $auth->acl_get('a_');
    }
}
