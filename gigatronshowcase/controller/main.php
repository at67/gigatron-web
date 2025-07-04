<?php
namespace at67\gigatronshowcase\controller;

class main
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

    public function handle()
    {
	// ADMIN ONLY CHECK
	global $phpbb_container;
	$auth = $phpbb_container->get('auth');
	if (!$auth->acl_get('a_')) {
	    throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
	}

	// Scan ROMs and GT1s
	$roms = $this->scanRoms();
	$gt1s = $this->scanGT1s();
	$featuredGT1s = $this->getFeaturedGT1s($gt1s);

	$this->template->assign_vars(array(
	    'ROMS' => $roms,
	    'FEATURED_GT1S' => $featuredGT1s,
	    'FEATURED_GT1' => $this->getFeaturedGT1(),
	    'U_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
	));

	return $this->helper->render('gigatronshowcase_main.html', 'Gigatron Showcase');
    }

    public function author($author, $category)
    {
	// Scan all GT1s and filter by author and category
	$allGt1s = $this->scanGT1s();
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

	$this->template->assign_vars(array(
	    'AUTHOR' => $author,
	    'CATEGORY' => $category,
	    'AUTHOR_GT1S' => $authorGt1s,
	    'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
	));

	return $this->helper->render('gigatronshowcase_author.html', ucfirst($author) . ' - ' . ucfirst($category));
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

	$this->template->assign_vars(array(
	'ROM' => $selectedRom,
	'SCREENSHOT_EXISTS' => $screenshotExists,
	'SCREENSHOT_URL' => $screenshotUrl,
	'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
	'U_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
	'ROM_DOWNLOAD_URL' => '/ext/at67/gigatronemulator/roms/' . $selectedRom['filename'],
	'U_EMULATOR_SCREENSHOT' => $this->helper->route('at67_gigatronemulator_main') . '?autoload_rom=' . urlencode($selectedRom['filename']) . '&screenshot_mode=1',
	));

	return $this->helper->render('gigatronshowcase_rom.html', $selectedRom['title'] . ' - ROM Details');
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
	$allGt1s = $this->scanGT1s();
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
	    $metadata = $this->parseIniMetadata($iniFile);
	    $selectedGt1 = array_merge($selectedGt1, $metadata);
	}

	// Check if screenshot exists
	$screenshotFilename = str_replace('.gt1', '.png', basename($selectedGt1['path']));
	$screenshotPath = dirname($fullFilePath) . '/' . $screenshotFilename;
	$screenshotExists = file_exists($screenshotPath);
	$screenshotUrl = $screenshotExists ? '/ext/at67/gigatronemulator/gt1/' . dirname($selectedGt1['path']) . '/' . $screenshotFilename . '?' . filemtime($screenshotPath) : null;

	// Calculate file size
	if (file_exists($fullFilePath)) {
	    $fileSize = filesize($fullFilePath);
	    $selectedGt1['filesize'] = $this->formatFileSize($fileSize);
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

    private function formatFileSize($bytes)
    {
	if ($bytes >= 1024) {
	    return round($bytes / 1024, 1) . ' KB';
	}
	return $bytes . ' bytes';
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

    public function saveScreenshot()
    {
	global $phpbb_container;
	$auth = $phpbb_container->get('auth');
	if (!$auth->acl_get('a_')) {
	    return new \Symfony\Component\HttpFoundation\JsonResponse(['success' => false, 'error' => 'NOT_AUTHORISED'], 403);
	}

	$request = $phpbb_container->get('request');
	$gt1Path = $request->variable('gt1_path', '');
	$romFilename = $request->variable('rom_filename', '');

	// Simple logic: GT1 takes priority if both exist, ROM only if GT1 doesn't exist
	if (!empty($gt1Path)) {
	    // GT1 mode (existing behavior) - takes priority
	    $isRomMode = false;
	    $isGt1Mode = true;
	} elseif (!empty($romFilename)) {
	    // ROM mode (new behavior) - only if no GT1
	    $isRomMode = true;
	    $isGt1Mode = false;
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
		    throw new Exception('Failed to create resized image');
		}

		if (!imagecopyresampled($resizedImage, $sourceImage, 0, 0, 0, 0, 480, 360, $width, $height)) {
		    imagedestroy($sourceImage);
		    imagedestroy($resizedImage);
		    throw new Exception('Failed to resize image');
		}

		if (!imagepng($resizedImage, $screenshotPath)) {
		    throw new Exception('Failed to save resized image');
		}

		imagedestroy($sourceImage);
		imagedestroy($resizedImage);

	    } catch (Exception $e) {
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

    private function getCategoryOrder()
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

    private function getFeaturedGT1()
    {
	// Get today's featured author
	$featuredAuthor = $this->getFeaturedAuthors();

	// Get all GT1s for this author
	$allGt1s = $this->scanGT1s();
	$authorGt1s = array();

	foreach ($allGt1s as $gt1) {
	    if ($gt1['author'] === $featuredAuthor) {
		$authorGt1s[] = $gt1;
	    }
	}

	if (empty($authorGt1s)) {
	    throw new \phpbb\exception\http_exception(500, 'Featured author "' . $featuredAuthor . '" has no GT1 files');
	}

	// Randomly select one GT1 from this author
	$selectedGt1 = $authorGt1s[array_rand($authorGt1s)];

	// Load metadata from .ini file
	$gt1Path = $this->root_path . 'ext/at67/gigatronemulator/gt1/';
	$fullFilePath = $gt1Path . $selectedGt1['path'];
	$iniFile = str_replace('.gt1', '.ini', $fullFilePath);

	if (file_exists($iniFile)) {
	    $metadata = $this->parseIniMetadata($iniFile);
	    $selectedGt1 = array_merge($selectedGt1, $metadata);
	}

	// Add screenshot info
	$selectedGt1 = $this->addScreenshotInfo($selectedGt1);

	// Ensure required fields are set
	if (!isset($selectedGt1['description'])) {
	    $selectedGt1['description'] = 'No description available.';
	}
	if (!isset($selectedGt1['rating'])) {
	    $selectedGt1['rating'] = '0/10';
	}
	if (!isset($selectedGt1['year'])) {
	    $selectedGt1['year'] = 'Unknown';
	}

	return $selectedGt1;
    }

    private function getFeaturedAuthors()
    {
	$featuredIni = $this->root_path . 'ext/at67/gigatronshowcase/featured.ini';
	$shuffleIni = $this->root_path . 'ext/at67/gigatronshowcase/featured_shuffle.ini';

	// Read the featured authors list
	if (!file_exists($featuredIni)) {
	    return 'at67'; // fallback
	}

	$featuredData = parse_ini_file($featuredIni);
	if ($featuredData === false || empty($featuredData)) {
	    return 'at67'; // fallback
	}

	ksort($featuredData);
	$authors = array_values($featuredData);
	$authorCount = count($authors);
	$today = date('Y-m-d');

	// Try to read existing shuffle file
	$validShuffleData = false;
	$cycleStart = null;
	$shuffledAuthors = array();

	if (file_exists($shuffleIni)) {
	    $shuffleData = parse_ini_file($shuffleIni);
	    if ($shuffleData !== false && isset($shuffleData['cycle_start'])) {
		$cycleStart = $shuffleData['cycle_start'];
		$daysSinceStart = (strtotime($today) - strtotime($cycleStart)) / (60 * 60 * 24);

		// Check if current cycle is still valid
		if ($daysSinceStart >= 0 && $daysSinceStart < $authorCount) {
		    // Extract shuffled authors
		    unset($shuffleData['cycle_start']);
		    ksort($shuffleData);
		    $shuffledAuthors = array_values($shuffleData);

		    // Verify we have the right number of authors
		    if (count($shuffledAuthors) === $authorCount) {
			$validShuffleData = true;
		    }
		}
	    }
	}

	// Create new shuffle cycle if needed
	if (!$validShuffleData) {
	    $shuffledAuthors = $authors;
	    shuffle($shuffledAuthors);
	    $cycleStart = $today;

	    // Save new shuffle file
	    $shuffleContent = "cycle_start=" . $cycleStart . "\n";
	    for ($i = 0; $i < count($shuffledAuthors); $i++) {
		$shuffleContent .= ($i + 1) . "=" . $shuffledAuthors[$i] . "\n";
	    }

	    file_put_contents($shuffleIni, $shuffleContent);
	}

	// Calculate which author to return today
	$daysSinceStart = (strtotime($today) - strtotime($cycleStart)) / (60 * 60 * 24);
	$currentDay = (int)$daysSinceStart % $authorCount;

	return $shuffledAuthors[$currentDay];
    }

    private function getFeaturedGT1s($gt1s)
    {
	$featured = array();

	// Group by category and author
	$grouped = array();
	foreach ($gt1s as $gt1) {
	    $category = $gt1['category'];
	    $author = $gt1['author'];
	    $grouped[$category][$author][] = $gt1;
	}

	// Get category order from INI
	$categoryOrder = $this->getCategoryOrder();

	// Process categories in the specified order first
	if (!empty($categoryOrder)) {
	    foreach ($categoryOrder as $categoryName) {
		if (isset($grouped[$categoryName])) {
		    $featured[$categoryName] = array();

		    foreach ($grouped[$categoryName] as $author => $files) {
			// Sort files alphabetically and take first one
			usort($files, function($a, $b) {
			    return strcmp($a['filename'], $b['filename']);
			});

			$featuredFile = $files[0];
			$featuredFile['total_count'] = count($files);

			// Add screenshot info using reusable method
			$featuredFile = $this->addScreenshotInfo($featuredFile);

			$featured[$categoryName][] = $featuredFile;
		    }

		    // Shuffle the authors within this category
		    shuffle($featured[$categoryName]);

		    // Remove from grouped so we don't process it again
		    unset($grouped[$categoryName]);
		}
	    }
	}

	// Process any remaining categories not in the order file
	foreach ($grouped as $category => $authors) {
	    $featured[$category] = array();

	    foreach ($authors as $author => $files) {
		// Sort files alphabetically and take first one
		usort($files, function($a, $b) {
		    return strcmp($a['filename'], $b['filename']);
		});

		$featuredFile = $files[0];
		$featuredFile['total_count'] = count($files);

		// Add screenshot info using reusable method
		$featuredFile = $this->addScreenshotInfo($featuredFile);

		$featured[$category][] = $featuredFile;
	    }

	    // Shuffle the authors within this category
	    shuffle($featured[$category]);
	}

	return $featured;
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
			'category' => 'Firmware',
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

    private function scanGT1s()
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
}
