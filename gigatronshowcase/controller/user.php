<?php

namespace at67\gigatronshowcase\controller;

require_once __DIR__ . '/utils.php';

class user
{
    protected $helper;
    protected $template;
    protected $user;
    protected $root_path;
    protected $content;

    public function __construct(\phpbb\controller\helper $helper, \phpbb\template\template $template, \phpbb\user $user, $root_path, $content)
    {
        $this->helper = $helper;
        $this->template = $template;
        $this->user = $user;
        $this->root_path = $root_path;
        $this->content = $content;
    }

    public function uploadForm($category = null)
    {
        // Check if user is logged in
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Get available categories
        $categories = $this->getAvailableCategories();

        // Get allowed source code domains
        $allowedDomains = $this->getAllowedDomains();

        $this->template->assign_vars(array(
            'CATEGORIES' => $categories,
            'SELECTED_CATEGORY' => $category,
            'USERNAME' => $this->user->data['username'],
            'ALLOWED_DOMAINS' => $allowedDomains,
            'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
            'U_PROCESS_UPLOAD' => $this->helper->route('at67_gigatronshowcase_process_upload'),
        ));

        $pageTitle = 'Upload GT1' . ($category ? ' to ' . ucfirst($category) : '');
        return $this->helper->render('user_upload.html', $pageTitle);
    }

    public function processUpload()
    {
        // Check if user is logged in
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        $request = $phpbb_container->get('request');

        // Get form data
        $title = trim($request->variable('title', ''));
        $category = trim($request->variable('category', ''));
        $description = trim($request->variable('description', ''));
        $version = trim($request->variable('version', ''));
        $language = trim($request->variable('language', ''));
        $releaseDate = trim($request->variable('release_date', ''));
        $ramModel = trim($request->variable('ram_model', '32K RAM'));
        $preferredRom = trim($request->variable('preferred_rom', 'ROMv6'));
        $compatibleRoms = trim($request->variable('compatible_roms', ''));
        $sourceCode = trim($request->variable('source_code', ''));
        $details = trim($request->variable('details', ''));

        // Validate required fields
        if (empty($title) || empty($category) || empty($description)) {
            $this->template->assign_var('ERROR', 'Please fill in all required fields (Title, Category, Description)');
            return $this->uploadForm($category);
        }

        // Validate category
        $availableCategories = $this->getAvailableCategories();
        if (!in_array($category, $availableCategories)) {
            $this->template->assign_var('ERROR', 'Invalid category selected');
            return $this->uploadForm($category);
        }

        // Validate GT1 file
        $gt1File = $request->file('gt1_file');
        if (!$gt1File || empty($gt1File['name'])) {
            $this->template->assign_var('ERROR', 'GT1 file is required');
            return $this->uploadForm($category);
        }

        if ($gt1File['size'] > 524288) {
            $this->template->assign_var('ERROR', 'GT1 file too large (maximum 512KB)');
            return $this->uploadForm($category);
        }

        if (pathinfo($gt1File['name'], PATHINFO_EXTENSION) !== 'gt1') {
            $this->template->assign_var('ERROR', 'File must be a .gt1 file');
            return $this->uploadForm($category);
        }

        // Validate GT1 file format
        require_once __DIR__ . '/security.php';
        $errorMessage = '';
        if (!validateGT1File($gt1File['tmp_name'], $errorMessage)) {
            $this->template->assign_var('ERROR', $errorMessage);
            return $this->uploadForm($category);
        }

        // Create filename from title
        $filename = $this->sanitizeFilename($title) . '.gt1';
        $username = $this->user->data['username'];

        // Check if file already exists
        $targetDir = $this->root_path . 'ext/at67/gigatronemulator/gt1/' . $category . '/' . $username . '/';
        $targetFile = $targetDir . $filename;
        if (file_exists($targetFile)) {
            $this->template->assign_var('ERROR', 'A GT1 with this title already exists. Please choose a different title.');
            return $this->uploadForm($category);
        }

        // Validate source code links against whitelist
        if (!$this->validateSourceCodeUrl($sourceCode)) {
            $allowedDomains = $this->getAllowedDomains();
            $this->template->assign_var('ERROR', 'Source code URL must be from an allowed domain: ' . implode(', ', $allowedDomains));
            return $this->uploadForm($category);
        }

        try {
            // Create directory if it doesn't exist
            if (!is_dir($targetDir)) {
                if (!mkdir($targetDir, 0755, true)) {
                    throw new \Exception('Failed to create directory');
                }
            }

            // Move GT1 file
            if (!move_uploaded_file($gt1File['tmp_name'], $targetFile)) {
                throw new \Exception('Failed to upload GT1 file');
            }

            // Create .ini metadata file
            $this->createIniFile($targetDir, $filename, array(
                'title' => $title,
                'description' => $description,
                'version' => $version,
                'language' => $language,
                'date' => $releaseDate,
                'ram_model' => $ramModel,
                'preferred_rom' => $preferredRom,
                'compatible_roms' => $compatibleRoms,
                'source_code' => $sourceCode,
                'details' => $details,
            ));

            logUserAction('CREATE', $category, null, $filename, null, filesize($targetFile), $username, $username);

            // Redirect to the new GT1 page
            $redirectUrl = $this->helper->route('at67_gigatronshowcase_gt1_file', array(
                'category' => $category,
                'author' => $username,
                'filename' => $filename
            ));

            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);

        } catch (\Exception $e) {
            // Clean up any uploaded files on error
            if (file_exists($targetFile)) {
                unlink($targetFile);
            }

            $this->template->assign_var('ERROR', 'Upload failed: ' . $e->getMessage());
            return $this->uploadForm($category);
        }
    }

    public function editForm($category, $author, $filename, $folder = null)
    {
        require_once __DIR__ . '/security.php';

        // Check if user is logged in
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Validate path components
        $validated = $this->validateAndSanitizePath($category, $author, $filename, $folder);
        $category = $validated['category'];
        $author = $validated['author'];
        $filename = $validated['filename'];
        $folder = $validated['folder'];

        // Verify user has access to this file
        try {
            $fileInfo = verifyUserFileAccess($category, $author, $filename, $folder, $this->root_path);
        } catch (\phpbb\exception\http_exception $e) {
            $redirectUrl = $this->helper->route('at67_gigatronshowcase_author', array(
                'category' => $category,
                'author' => $this->user->data['username']
            ));
            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);
        }

        // Use verified file path
        $gt1Path = $fileInfo['file_path'];
        $iniPath = str_replace('.gt1', '.ini', $gt1Path);

        // Load metadata
        $metadata = array();
        if (file_exists($iniPath)) {
            $metadata = parseIniMetadata($iniPath);
        }

        // Get file info
        $fileSize = filesize($gt1Path);
        $screenshotExists = file_exists(str_replace('.gt1', '.png', $gt1Path));

        // Get source code whitelist
        $allowedDomains = $this->getAllowedDomains();

        $this->template->assign_vars(array(
            'GT1_DATA' => $metadata,
            'CATEGORY' => $category,
            'AUTHOR' => $author,
            'FILENAME' => $filename,
            'FOLDER' => $folder,
            'FILE_SIZE' => formatFileSize($fileSize),
            'SCREENSHOT_EXISTS' => $screenshotExists,
            'CATEGORIES' => $this->getAvailableCategories(),
            'ALLOWED_DOMAINS' => $allowedDomains,
            'U_BACK_TO_GT1' => $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_gt1_folder' : 'at67_gigatronshowcase_gt1_file',
                array(
                    'category' => $category,
                    'author' => $author,
                    'filename' => $filename,
                    'folder' => $folder
                )
            ),
            'U_PROCESS_EDIT' => $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_process_edit_folder' : 'at67_gigatronshowcase_process_edit',
                array(
                    'category' => $category,
                    'author' => $author,
                    'filename' => $filename,
                    'folder' => $folder
                )
            ),
        ));

        return $this->helper->render('user_edit.html', 'Edit GT1 Application');
    }

    public function processEdit($category, $author, $filename, $folder = null)
    {
        require_once __DIR__ . '/security.php';

        // Check if user is logged in
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Validate path components
        $validated = $this->validateAndSanitizePath($category, $author, $filename, $folder);
        $category = $validated['category'];
        $author = $validated['author'];
        $filename = $validated['filename'];
        $folder = $validated['folder'];

        // Verify user has access to this file
        try {
            $fileInfo = verifyUserFileAccess($category, $author, $filename, $folder, $this->root_path);
        } catch (\phpbb\exception\http_exception $e) {
            $redirectUrl = $this->helper->route('at67_gigatronshowcase_author', array(
                'category' => $category,
                'author' => $this->user->data['username']
            ));
            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);
        }

        $request = $phpbb_container->get('request');

        // Get form data
        $title = trim($request->variable('title', ''));
        $newCategory = trim($request->variable('category', ''));
        $description = trim($request->variable('description', ''));
        $version = trim($request->variable('version', ''));
        $language = trim($request->variable('language', ''));
        $releaseDate = trim($request->variable('release_date', ''));
        $ramModel = trim($request->variable('ram_model', '32K RAM'));
        $preferredRom = trim($request->variable('preferred_rom', 'ROMv6'));
        $compatibleRoms = trim($request->variable('compatible_roms', ''));
        $sourceCode = trim($request->variable('source_code', ''));
        $details = trim($request->variable('details', ''));

        // Validate new category
        $this->validatePathComponent($newCategory, 'category');
        $allowedCategories = $this->getAvailableCategories();
        if (!in_array($newCategory, $allowedCategories)) {
            $this->template->assign_var('ERROR', 'Invalid category selected');
            return $this->editForm($category, $author, $filename, $folder);
        }

        // Validate required fields
        if (empty($title) || empty($newCategory) || empty($description)) {
            $this->template->assign_var('ERROR', 'Please fill in all required fields');
            return $this->editForm($category, $author, $filename, $folder);
        }

        // Validate source code URL
        if (!$this->validateSourceCodeUrl($sourceCode)) {
            $allowedDomains = $this->getAllowedDomains();
            $this->template->assign_var('ERROR', 'Source code URL must be from an allowed domain: ' . implode(', ', $allowedDomains));
            return $this->editForm($category, $author, $filename, $folder);
        }

        try {
            // Use verified file path
            $currentGt1Path = $fileInfo['file_path'];
            $currentIniPath = str_replace('.gt1', '.ini', $currentGt1Path);

            // Handle GT1 file replacement
            $gt1File = $request->file('gt1_file');
            if ($gt1File && !empty($gt1File['name'])) {
                // Check file size (512KB limit)
                if ($gt1File['size'] > 524288) {
                    throw new \Exception('GT1 file too large (maximum 512KB)');
                }

                if (pathinfo($gt1File['name'], PATHINFO_EXTENSION) !== 'gt1') {
                    throw new \Exception('GT1 file must be a .gt1 file');
                }
                if (!move_uploaded_file($gt1File['tmp_name'], $currentGt1Path)) {
                    throw new \Exception('Failed to update GT1 file');
                }
            }

            // Update .ini metadata file
            if ($folder !== null) {
                $iniDir = dirname($currentIniPath) . '/';
                $iniFilename = basename($currentIniPath);
            } else {
                $iniDir = dirname($currentGt1Path) . '/';
                $iniFilename = str_replace('.gt1', '.ini', $filename);
            }

            $this->createIniFile($iniDir, $iniFilename, array(
                'title' => $title,
                'description' => $description,
                'version' => $version,
                'language' => $language,
                'date' => $releaseDate,
                'ram_model' => $ramModel,
                'preferred_rom' => $preferredRom,
                'compatible_roms' => $compatibleRoms,
                'source_code' => $sourceCode,
                'details' => $details,
            ));

            $fileSize = file_exists($currentGt1Path) ? filesize($currentGt1Path) : 0;
            logUserAction('EDIT', $category, $folder, $filename, null, $fileSize, $fileInfo['actual_author'], $fileInfo['trusted_username']);

            // If category changed, move files
            if ($newCategory !== $category) {
                // Determine the actual author for new path
                $actualAuthor = $fileInfo['actual_author'];
                $newDir = $this->root_path . 'ext/at67/gigatronemulator/gt1/' . $newCategory . '/' . $actualAuthor . '/';

                if (!is_dir($newDir)) {
                    mkdir($newDir, 0755, true);
                }

                if ($folder !== null) {
                    // For folder-based files, create the folder in the new location
                    $newFolderDir = $newDir . $folder . '/';
                    if (!is_dir($newFolderDir)) {
                        mkdir($newFolderDir, 0755, true);
                    }
                    $newGt1Path = $newFolderDir . $filename;
                    $newIniPath = str_replace('.gt1', '.ini', $newGt1Path);
                    $newScreenshotPath = str_replace('.gt1', '.png', $newGt1Path);
                } else {
                    $newGt1Path = $newDir . $filename;
                    $newIniPath = str_replace('.gt1', '.ini', $newGt1Path);
                    $newScreenshotPath = str_replace('.gt1', '.png', $newGt1Path);
                }

                rename($currentGt1Path, $newGt1Path);
                rename($currentIniPath, $newIniPath);

                // Move existing screenshot (captured via emulator) if it exists
                $currentScreenshotPath = str_replace('.gt1', '.png', $currentGt1Path);
                if (file_exists($currentScreenshotPath)) {
                    rename($currentScreenshotPath, $newScreenshotPath);
                }

                $category = $newCategory;
            }

            // Redirect to updated GT1 page - use actual author
            $redirectUrl = $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_gt1_folder' : 'at67_gigatronshowcase_gt1_file',
                array(
                    'category' => $category,
                    'author' => $fileInfo['actual_author'],
                    'filename' => $filename,
                    'folder' => $folder
                )
            );

            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);

        } catch (\Exception $e) {
            $this->template->assign_var('ERROR', 'Update failed: ' . $e->getMessage());
            return $this->editForm($category, $author, $filename, $folder);
        }
    }

    public function deleteConfirm($category, $author, $filename, $folder = null)
    {
        require_once __DIR__ . '/security.php';

        // Check if user is logged in
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Validate path components
        $validated = $this->validateAndSanitizePath($category, $author, $filename, $folder);
        $category = $validated['category'];
        $author = $validated['author'];
        $filename = $validated['filename'];
        $folder = $validated['folder'];

        // Verify user has access to this file
        try {
            $fileInfo = verifyUserFileAccess($category, $author, $filename, $folder, $this->root_path);
        } catch (\phpbb\exception\http_exception $e) {
            $redirectUrl = $this->helper->route('at67_gigatronshowcase_author', array(
                'category' => $category,
                'author' => $this->user->data['username']
            ));
            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);
        }

        // Use verified file path
        $gt1Path = $fileInfo['file_path'];
        $iniPath = str_replace('.gt1', '.ini', $gt1Path);

        // Load metadata
        $metadata = array();
        if (file_exists($iniPath)) {
            $metadata = parseIniMetadata($iniPath);
        }

        // Get file info
        $gt1Size = filesize($gt1Path);
        $screenshotPath = str_replace('.gt1', '.png', $gt1Path);
        $screenshotSize = file_exists($screenshotPath) ? filesize($screenshotPath) : 0;
        $downloads = isset($metadata['downloads']) ? $metadata['downloads'] : 0;

        $this->template->assign_vars(array(
            'GT1_DATA' => $metadata,
            'CATEGORY' => $category,
            'AUTHOR' => $author,
            'FILENAME' => $filename,
            'FOLDER' => $folder,
            'GT1_SIZE' => formatFileSize($gt1Size),
            'SCREENSHOT_SIZE' => $screenshotSize > 0 ? formatFileSize($screenshotSize) : null,
            'DOWNLOADS' => $downloads,
            'U_BACK_TO_GT1' => $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_gt1_folder' : 'at67_gigatronshowcase_gt1_file',
                array(
                    'category' => $category,
                    'author' => $author,
                    'filename' => $filename,
                    'folder' => $folder
                )
            ),
            'U_PROCESS_DELETE' => $this->helper->route(
                $folder !== null ? 'at67_gigatronshowcase_process_delete_folder' : 'at67_gigatronshowcase_process_delete',
                array(
                    'category' => $category,
                    'author' => $author,
                    'filename' => $filename,
                    'folder' => $folder
                )
            ),
        ));

        return $this->helper->render('user_delete.html', 'Delete GT1 Application');
    }

    public function processDelete($category, $author, $filename, $folder = null)
    {
        require_once __DIR__ . '/security.php';

        // Check if user is logged in
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Validate path components
        $validated = $this->validateAndSanitizePath($category, $author, $filename, $folder);
        $category = $validated['category'];
        $author = $validated['author'];
        $filename = $validated['filename'];
        $folder = $validated['folder'];

        // Verify user has access to this file
        try {
            $fileInfo = verifyUserFileAccess($category, $author, $filename, $folder, $this->root_path);
        } catch (\phpbb\exception\http_exception $e) {
            $redirectUrl = $this->helper->route('at67_gigatronshowcase_author', array(
                'category' => $category,
                'author' => $this->user->data['username']
            ));
            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);
        }

        $request = $phpbb_container->get('request');
        $confirmation = trim($request->variable('confirmation', ''));

        // Require DELETE confirmation
        if (strtoupper($confirmation) !== 'DELETE') {
            $this->template->assign_var('ERROR', 'You must type "DELETE" to confirm deletion');
            return $this->deleteConfirm($category, $author, $filename, $folder);
        }

        try {
            // Use verified file paths
            $gt1Path = $fileInfo['file_path'];
            $iniPath = str_replace('.gt1', '.ini', $gt1Path);
            $screenshotPath = str_replace('.gt1', '.png', $gt1Path);

            $fileSize = file_exists($gt1Path) ? filesize($gt1Path) : 0;
            logUserAction('DELETE', $category, $folder, $filename, null, $fileSize, $fileInfo['actual_author'], $fileInfo['trusted_username']);

            // Delete files
            if (file_exists($gt1Path)) {
                unlink($gt1Path);
            }
            if (file_exists($iniPath)) {
                unlink($iniPath);
            }
            if (file_exists($screenshotPath)) {
                unlink($screenshotPath);
            }

            // If this was in a folder, remove the folder if it's empty
            if ($folder !== null) {
                $folderPath = dirname($gt1Path);
                if (is_dir($folderPath) && count(scandir($folderPath)) === 2) { // only . and ..
                    rmdir($folderPath);
                }
            }

            // Redirect to author page - use actual author
            $redirectUrl = $this->helper->route('at67_gigatronshowcase_author', array(
                'author' => $fileInfo['actual_author'],
                'category' => $category
            ));

            return new \Symfony\Component\HttpFoundation\RedirectResponse($redirectUrl);

        } catch (\Exception $e) {
            $this->template->assign_var('ERROR', 'Deletion failed: ' . $e->getMessage());
            return $this->deleteConfirm($category, $author, $filename, $folder);
        }
    }

    private function getAvailableCategories()
    {
        $categoryOrder = $this->content->getCategoryOrder();
        if (!empty($categoryOrder)) {
            return $categoryOrder;
        }

        // Fallback: scan existing categories
        $gt1Path = $this->root_path . 'ext/at67/gigatronemulator/gt1/';
        $categories = array();

        if (is_dir($gt1Path)) {
            $dirs = scandir($gt1Path);
            foreach ($dirs as $dir) {
                if ($dir !== '.' && $dir !== '..' && is_dir($gt1Path . $dir)) {
                    $categories[] = $dir;
                }
            }
        }

        return $categories;
    }

    private function sanitizeFilename($title)
    {
        // Remove special characters and spaces, replace with underscores
        $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $title);
        $filename = preg_replace('/_+/', '_', $filename);
        $filename = trim($filename, '_');

        if (empty($filename)) {
            $filename = 'untitled';
        }

        return $filename;
    }

    private function createIniFile($directory, $filename, $metadata)
    {
        $iniPath = $directory . str_replace('.gt1', '.ini', $filename);

        $content = '';
        foreach ($metadata as $key => $value) {
            if (!empty($value)) {
                $content .= $key . '=' . $value . "\n";
            }
        }

        file_put_contents($iniPath, $content, LOCK_EX);
    }

    private function validatePathComponent($path, $type = 'path')
    {
        if (empty($path)) {
            return true; // Allow empty paths (like null folder)
        }

        // Check for directory traversal attempts
        if (strpos($path, '..') !== false) {
            throw new \phpbb\exception\http_exception(400, "Invalid $type: contains directory traversal");
        }

        // Check for absolute paths
        if (strpos($path, '/') === 0 || strpos($path, '\\') === 0) {
            throw new \phpbb\exception\http_exception(400, "Invalid $type: cannot be absolute path");
        }

        // Check for path separators in filenames (folders can have them)
        if ($type === 'filename' && (strpos($path, '/') !== false || strpos($path, '\\') !== false)) {
            throw new \phpbb\exception\http_exception(400, "Invalid filename: cannot contain path separators");
        }

        // Check for null bytes
        if (strpos($path, "\0") !== false) {
            throw new \phpbb\exception\http_exception(400, "Invalid $type: contains null byte");
        }

        // Check for dangerous characters
        $dangerousChars = ['<', '>', ':', '"', '|', '?', '*'];
        foreach ($dangerousChars as $char) {
            if (strpos($path, $char) !== false) {
                throw new \phpbb\exception\http_exception(400, "Invalid $type: contains forbidden character '$char'");
            }
        }

        return true;
    }

    private function validateAndSanitizePath($category, $author, $filename, $folder = null)
    {
        // Validate each component
        $this->validatePathComponent($category, 'category');
        $this->validatePathComponent($author, 'author');
        $this->validatePathComponent($filename, 'filename');
        if ($folder !== null) {
            $this->validatePathComponent($folder, 'folder');
        }

        // Additional filename validation
        if (!preg_match('/^[a-zA-Z0-9_\-\.\(\)\[\] ]+\.gt1$/', $filename)) {
            throw new \phpbb\exception\http_exception(400, 'Filename contains invalid characters or wrong format');
        }

        // Validate category against allowed categories
        $allowedCategories = $this->getAvailableCategories();
        if (!in_array($category, $allowedCategories)) {
            throw new \phpbb\exception\http_exception(400, 'Invalid category');
        }

        return [
            'category' => $category,
            'author' => $author,
            'filename' => $filename,
            'folder' => $folder
        ];
    }

    private function getAllowedDomains()
    {
        $whitelistFile = $this->root_path . 'ext/at67/gigatronshowcase/whitelist.ini';
        $allowedDomains = array();

        if (file_exists($whitelistFile)) {
            $domains = parse_ini_file($whitelistFile);
            if ($domains !== false) {
                $allowedDomains = array_values($domains);
            }
        }

        // Fallback domains if file doesn't exist or is empty
        if (empty($allowedDomains)) {
            $allowedDomains = array('github.com', 'gitlab.com', 'forum.gigatron.io');
        }

        return $allowedDomains;
    }

    private function validateSourceCodeUrl($url)
    {
        if (empty($url)) {
            return true; // Empty URL is allowed (optional field)
        }

        // Parse the URL to get the domain
        $parsedUrl = parse_url($url);
        if ($parsedUrl === false || !isset($parsedUrl['host'])) {
            return false; // Invalid URL format
        }

        $domain = strtolower($parsedUrl['host']);

        // Remove www. prefix if present
        if (strpos($domain, 'www.') === 0) {
            $domain = substr($domain, 4);
        }

        $allowedDomains = $this->getAllowedDomains();

        return in_array($domain, $allowedDomains);
    }
}
