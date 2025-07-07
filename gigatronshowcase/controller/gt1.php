<?php
namespace at67\gigatronshowcase\controller;

require_once __DIR__ . '/utils.php';

class gt1
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

    public function author($author, $category)
    {
        // Scan all GT1s and filter by author and category
        $allGt1s = scanGT1s($this->root_path);
        $authorGt1s = array();

        foreach ($allGt1s as $gt1) {
            if ($gt1['author'] === $author && $gt1['category'] === $category) {
                // Add screenshot info to each GT1
                $gt1 = $this->addScreenshotInfo($gt1);
                $authorGt1s[] = $gt1;
            }
        }

        // Sort by filename
        usort($authorGt1s, function($a, $b) {
            return strcmp($a['filename'], $b['filename']);
        });

        // Read current featured selection
        $currentFeatured = null;
        $featuredIniPath = $this->root_path . 'ext/at67/gigatronemulator/gt1/' . $category . '/' . $author . '/featured.ini';

        if (file_exists($featuredIniPath)) {
            $featuredData = parse_ini_file($featuredIniPath);
            if ($featuredData !== false && isset($featuredData['featured_screenshot']) && !empty($featuredData['featured_screenshot'])) {
                $currentFeatured = $featuredData['featured_screenshot'];
            }
        }

        $this->template->assign_vars(array(
            'AUTHOR' => $author,
            'CATEGORY' => $category,
            'AUTHOR_GT1S' => $authorGt1s,
            'CURRENT_FEATURED' => $currentFeatured,
            'CURRENT_USERNAME' => $this->user->data['username'],
            'IS_ADMIN' => $this->checkAdminPermission(),
            'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
            'U_UPLOAD_TO_CATEGORY' => $this->helper->route('at67_gigatronshowcase_upload_gt1_category', array(
                'category' => $category
            )),
        ));

        return $this->helper->render('gigatronshowcase_author.html', ucfirst($author) . ' - ' . ucfirst($category));
    }

    public function authorOverview($author)
    {
        // Get all GT1s by this author across all categories
        $allGt1s = scanGT1s($this->root_path);
        $authorGt1s = array();

        foreach ($allGt1s as $gt1) {
            if ($gt1['author'] === $author) {
                // Add screenshot info to each GT1
                $gt1 = $this->addScreenshotInfo($gt1);
                $authorGt1s[] = $gt1;
            }
        }

        // Sort alphabetically by title
        usort($authorGt1s, function($a, $b) {
            return strcmp($a['title'], $b['title']);
        });

        $this->template->assign_vars(array(
            'AUTHOR' => $author,
            'AUTHOR_GT1S' => $authorGt1s,
            'CURRENT_USERNAME' => $this->user->data['username'],
            'IS_ADMIN' => $this->checkAdminPermission(),
            'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
        ));

        return $this->helper->render('author_overview.html', ucfirst($author) . ' - All GT1s');
    }

    public function setFeaturedScreenshot()
    {
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        $user = $phpbb_container->get('user');
        $request = $phpbb_container->get('request');

        // Check if user is logged in
        if (!$auth->acl_get('u_')) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Not authorized'], 403);
        }

        $gt1Path = trim($request->variable('gt1_path', ''));
        $category = trim($request->variable('category', ''));
        $author = trim($request->variable('author', ''));

        if (empty($gt1Path) || empty($category) || empty($author)) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Missing parameters'], 400);
        }

        // Check if user owns this GT1 or is admin
        $isAdmin = $auth->acl_get('a_');
        $currentUsername = $user->data['username'];

        if (!$isAdmin && $currentUsername !== $author) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Not authorized'], 403);
        }

        try {
            // Convert GT1 path to screenshot path
            $gt1Filename = basename($gt1Path);
            $screenshotFilename = str_replace('.gt1', '.png', $gt1Filename);

            // Handle subfolder case
            $pathParts = explode('/', $gt1Path);
            if (count($pathParts) > 3) {
                $subfolder = $pathParts[2];
                $screenshotPath = $subfolder . '/' . $screenshotFilename;
            } else {
                $screenshotPath = $screenshotFilename;
            }

            // Update featured.ini file
            $featuredIniPath = $this->root_path . 'ext/at67/gigatronemulator/gt1/' . $category . '/' . $author . '/featured.ini';
            $featuredContent = "featured_screenshot=" . $screenshotPath . "\n";

            if (!file_put_contents($featuredIniPath, $featuredContent, LOCK_EX)) {
                throw new \Exception('Failed to write featured.ini file');
            }

            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => true, 'message' => 'Featured screenshot updated']);

        } catch (\Exception $e) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Failed to update: ' . $e->getMessage()], 500);
        }
    }

    public function gt1($category, $author, $filename, $folder = null)
    {
        // Build filepath based on whether we have a folder or not
        if ($folder !== null) {
            // Subfolder case: games/at67/Invader/Invader.gt1
            $filepath = $folder . '/' . $filename;
        } else {
            // Direct file case: games/at67/Tetris.gt1
            $filepath = $filename;
        }

        // Find the specific GT1 file
        $allGt1s = scanGT1s($this->root_path);
        $selectedGt1 = null;

        // Build the full path we're looking for
        $targetPath = $category . '/' . $author . '/' . $filepath;

        foreach ($allGt1s as $gt1) {
            if ($gt1['path'] === $targetPath) {
                $selectedGt1 = $gt1;
                break;
            }
        }

        if (!$selectedGt1) {
            throw new \phpbb\exception\http_exception(404, 'GT1 file not found');
        }

        // Try to load metadata from .ini file
        $gt1Path = $this->root_path . 'ext/at67/gigatronemulator/gt1/';
        $fullFilePath = $gt1Path . $selectedGt1['path'];
        $iniFile = str_replace('.gt1', '.ini', $fullFilePath);

        // Load metadata if .ini file exists
        if (file_exists($iniFile)) {
            $metadata = parseIniMetadata($iniFile);
            $selectedGt1 = array_merge($selectedGt1, $metadata);
        }

        // Check for RAM model - default to 32K, auto-detect 64K from filename, or use .ini value
        if (!isset($selectedGt1['ram_model'])) {
            // Default to 32K RAM
            $selectedGt1['ram_model'] = '32K RAM';

            // Check if filename contains "64k"
            if (stripos($selectedGt1['filename'], '64k') !== false) {
                $selectedGt1['ram_model'] = '64K RAM';
            }
        }

        // Check if screenshot exists
        $screenshotFilename = str_replace('.gt1', '.png', basename($selectedGt1['path']));
        $screenshotPath = dirname($fullFilePath) . '/' . $screenshotFilename;
        $screenshotExists = file_exists($screenshotPath);
        $screenshotUrl = $screenshotExists ? '/ext/at67/gigatronemulator/gt1/' . dirname($selectedGt1['path']) . '/' . $screenshotFilename . '?' . filemtime($screenshotPath) : null;

        // Calculate file size
        if (file_exists($fullFilePath)) {
            $fileSize = filesize($fullFilePath);
            $selectedGt1['filesize'] = formatFileSize($fileSize);
        }

        // Parse compatible ROMs if specified
        $compatibleRoms = array();
        if (isset($selectedGt1['compatible_roms'])) {
            $compatibleRoms = array_map('trim', explode(',', $selectedGt1['compatible_roms']));
            $selectedGt1['compatible_roms'] = $compatibleRoms;
        }

        $this->template->assign_vars(array(
            'GT1' => $selectedGt1,
            'AUTHOR' => $author,
            'CATEGORY' => $category,
            'SCREENSHOT_EXISTS' => $screenshotExists,
            'SCREENSHOT_URL' => $screenshotUrl,
            'GT1_DOWNLOAD_URL' => '/ext/at67/gigatronemulator/gt1/' . $selectedGt1['path'],
            'CURRENT_USERNAME' => $this->user->data['username'], // Add current user
            'IS_ADMIN' => $this->checkAdminPermission(), // Add admin check
            'U_EDIT_GT1' => $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_edit_gt1_folder' : 'at67_gigatronshowcase_edit_gt1',
                array(
                    'category' => $category,
                    'author' => $author,
                    'filename' => $filename,
                    'folder' => $folder
                )
            ),
            'U_DELETE_GT1' => $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_delete_gt1_folder' : 'at67_gigatronshowcase_delete_gt1',
                array(
                    'category' => $category,
                    'author' => $author,
                    'filename' => $filename,
                    'folder' => $folder
                )
            ),
            'U_BACK_TO_AUTHOR' => $this->helper->route('at67_gigatronshowcase_author', array(
                'author' => $author,
                'category' => $category
            )),
            'U_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
            'U_EMULATOR_SCREENSHOT' => $this->helper->route('at67_gigatronemulator_main') . '?autoload_rom=' . urlencode($selectedGt1['preferred_rom'] ?? 'ROMv6') . '.rom&autoload_gt1=' . urlencode($selectedGt1['path']) . '&screenshot_mode=1',
            'COMPATIBLE_ROMS' => $compatibleRoms,
        ));

        return $this->helper->render('gigatronshowcase_gt1.html', $selectedGt1['title'] . ' - GT1 Details');
    }

    public function downloadTrackerGt1File($category, $author, $filename)
    {
        $gt1Path = $category . '/' . $author . '/' . $filename;
        return $this->handleGt1Download($gt1Path, $filename);
    }

    public function downloadTrackerGt1Folder($category, $author, $folder, $filename)
    {
        $gt1Path = $category . '/' . $author . '/' . $folder . '/' . $filename;
        return $this->handleGt1Download($gt1Path, $filename);
    }

    private function handleGt1Download($gt1Path, $filename)
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

        // Validate path - prevent directory traversal
        if (strpos($gt1Path, '..') !== false || strpos($gt1Path, '\\') !== false) {
            throw new \phpbb\exception\http_exception(400, 'Invalid path');
        }

        // Check if GT1 file exists
        $gt1FullPath = $this->root_path . 'ext/at67/gigatronemulator/gt1/' . $gt1Path;

        if (!file_exists($gt1FullPath)) {
            throw new \phpbb\exception\http_exception(404, 'GT1 file not found');
        }

        // Check/update download tracking in .ini file
        $iniFilename = str_replace('.gt1', '.ini', $filename);
        $iniFilePath = dirname($gt1FullPath) . '/' . $iniFilename;

        $downloadCount = 0;
        $downloadedBy = array();

        // Read existing .ini file if it exists
        if (file_exists($iniFilePath)) {
            $iniData = parseIniMetadata($iniFilePath);
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
            updateDownloadIni($iniFilePath, $downloadCount, $downloadedBy);
        }

        // Serve the file
        $response = new \Symfony\Component\HttpFoundation\BinaryFileResponse($gt1FullPath);
        $response->setContentDisposition(
            \Symfony\Component\HttpFoundation\ResponseHeaderBag::DISPOSITION_ATTACHMENT,
            $filename
        );

        return $response;
    }

    private function addScreenshotInfo($gt1)
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

    private function checkAdminPermission()
    {
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        return $auth->acl_get('a_');
    }
}
