<?php

namespace at67\gigatronshowcase\controller;

class main
{
    protected $helper;
    protected $template;
    protected $user;
    protected $root_path;
    protected $content;
    protected $featured;

    public function __construct(\phpbb\controller\helper $helper, \phpbb\template\template $template, \phpbb\user $user, $root_path, $content, $featured)
    {
        $this->helper = $helper;
        $this->template = $template;
        $this->user = $user;
        $this->root_path = $root_path;
        $this->content = $content;
        $this->featured = $featured;
    }

    public function handle()
    {
        // ADMIN ONLY CHECK
        //global $phpbb_container;
        //$auth = $phpbb_container->get('auth');
        //if (!$auth->acl_get('a_')) {
        //    throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        //}
        // REGISTERED MEMBERS ONLY CHECK
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        // Scan ROMs and GT1s using content service
        $roms = $this->content->scanRoms();
        $gt1s = $this->content->scanGT1s();
        $featuredGT1s = $this->featured->getFeaturedGT1s($gt1s);

        $this->template->assign_vars(array(
            'ROMS' => $roms,
            'FEATURED_GT1S' => $featuredGT1s,
            'FEATURED_GT1' => $this->featured->getFeaturedGT1(),
            'U_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
        ));

        return $this->helper->render('gigatronshowcase_main.html', 'Gigatron Showcase');
    }

    public function saveScreenshot()
    {
        require_once __DIR__ . '/security.php';

        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        $user = $phpbb_container->get('user');

        // Check if user is logged in
        if (!$auth->acl_get('u_')) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'NOT_AUTHORISED'], 403);
        }

        $request = $phpbb_container->get('request');
        $gt1Path = $request->variable('gt1_path', '');
        $romFilename = $request->variable('rom_filename', '');

        // Simple logic: GT1 takes priority if both exist, ROM only if GT1 doesn't exist
        if (!empty($gt1Path)) {
            // GT1 mode - use secure verification
            $isRomMode = false;
            $isGt1Mode = true;

            // Parse GT1 path
            $pathParts = explode('/', $gt1Path);
            if (count($pathParts) < 3) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Invalid GT1 path'], 400);
            }

            $category = $pathParts[0];
            $urlAuthor = $pathParts[1];
            $filename = end($pathParts);
            $folder = (count($pathParts) > 3) ? $pathParts[2] : null;

            // Use shared security verification
            try {
                $fileInfo = verifyUserFileAccess($category, $urlAuthor, $filename, $folder, $this->root_path);
                $fullGt1Path = $fileInfo['file_path'];
            } catch (\phpbb\exception\http_exception $e) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => $e->getMessage()], $e->getStatusCode());
            }
        } elseif (!empty($romFilename)) {
            // ROM mode - admin only
            $isRomMode = true;
            $isGt1Mode = false;

            if (!$auth->acl_get('a_')) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'ROM screenshots require admin privileges'], 403);
            }

        } else {
            // Neither parameter provided
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Missing required parameters (gt1_path or rom_filename)'], 400);
        }

        // Enhanced path validation - prevent directory traversal
        if ($isRomMode) {
            if (strpos($romFilename, '..') !== false || strpos($romFilename, '/') !== false || strpos($romFilename, '\\') !== false) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Invalid ROM filename'], 400);
            }

            $fullRomPath = $this->root_path . 'ext/at67/gigatronemulator/roms/' . $romFilename;
            if (!file_exists($fullRomPath)) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'ROM file not found'], 404);
            }

            $targetDirectory = dirname($fullRomPath);
            $screenshotFilename = str_replace('.rom', '.png', $romFilename);
            $screenshotPath = $targetDirectory . '/' . $screenshotFilename;
        } else {
            // GT1 mode - existing logic
            if (strpos($gt1Path, '..') !== false || strpos($gt1Path, '\\') !== false) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Invalid path'], 400);
            }

            $fullGt1Path = $this->root_path . 'ext/at67/gigatronemulator/gt1/' . $gt1Path;
            if (!file_exists($fullGt1Path)) {
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'GT1 file not found'], 404);
            }

            $targetDirectory = dirname($fullGt1Path);
            $gt1Filename = basename($gt1Path);
            $screenshotFilename = str_replace('.gt1', '.png', $gt1Filename);
            $screenshotPath = $targetDirectory . '/' . $screenshotFilename;
        }

        // Get uploaded file through phpBB
        $uploadedFile = $request->file('screenshot');

        if (!$uploadedFile) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'No file uploaded'], 400);
        }

        // Enhanced file size validation
        if ($uploadedFile['size'] > 524288) { // 512KB limit
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'File too large'], 400);
        }

        // Validate file type more strictly
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $uploadedFile['tmp_name']);
        finfo_close($finfo);

        if ($mimeType !== 'image/png') {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'File must be PNG'], 400);
        }

        // Check disk space (require at least 10MB free)
        if (disk_free_space($targetDirectory) < 10485760) {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Insufficient disk space'], 500);
        }

        if (move_uploaded_file($uploadedFile['tmp_name'], $screenshotPath)) {
            try {
                // Enhanced image processing with error handling
                $sourceImage = imagecreatefrompng($screenshotPath);
                if ($sourceImage === false) {
                    throw new \Exception('Failed to create image from PNG');
                }

                // Validate image dimensions to prevent memory exhaustion
                $width = imagesx($sourceImage);
                $height = imagesy($sourceImage);
                if ($width != 640 || $height != 480) {
                    imagedestroy($sourceImage);
                    unlink($screenshotPath);
                    return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Invalid image dimensions'], 400);
                }

                // Process scanlines - copy scanline 0 to lines 1,2,3 in every group of 4
                for ($y = 0; $y < $height; $y += 4) {
                    if ($y + 1 < $height) imagecopy($sourceImage, $sourceImage, 0, $y + 1, 0, $y, $width, 1);
                    if ($y + 2 < $height) imagecopy($sourceImage, $sourceImage, 0, $y + 2, 0, $y, $width, 1);
                    if ($y + 3 < $height) imagecopy($sourceImage, $sourceImage, 0, $y + 3, 0, $y, $width, 1);
                }

                $resizedImage = imagecreatetruecolor(480, 360);
                if ($resizedImage === false) {
                    imagedestroy($sourceImage);
                    throw new \Exception('Failed to create resized image');
                }

                if (!imagecopyresampled($resizedImage, $sourceImage, 0, 0, 0, 0, 480, 360, $width, $height)) {
                    imagedestroy($sourceImage);
                    imagedestroy($resizedImage);
                    throw new \Exception('Failed to resize image');
                }

                if (!imagepng($resizedImage, $screenshotPath)) {
                    throw new \Exception('Failed to save resized image');
                }

                imagedestroy($sourceImage);
                imagedestroy($resizedImage);

            } catch (\Exception $e) {
                // Clean up on error
                if (file_exists($screenshotPath)) {
                    unlink($screenshotPath);
                }
                return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Image processing failed: ' . $e->getMessage()], 500);
            }

            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => true, 'message' => 'Screenshot saved successfully', 'filename' => $screenshotFilename]);
        } else {
            return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'Failed to save screenshot'], 500);
        }
    }
}
