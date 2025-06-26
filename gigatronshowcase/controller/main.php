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

	$this->template->assign_vars(array(
	    'ROM' => $selectedRom,
	    'U_BACK_TO_SHOWCASE' => $this->helper->route('at67_gigatronshowcase_main'),
	    'U_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
	    'ROM_DOWNLOAD_URL' => '/ext/at67/gigatronemulator/roms/' . $selectedRom['filename'],
	));

	return $this->helper->render('gigatronshowcase_rom.html', $selectedRom['title'] . ' - ROM Details');
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

	// Pick first item from each author in each category
	foreach ($grouped as $category => $authors) {
	    $featured[$category] = array();

	    foreach ($authors as $author => $files) {
		// Sort files alphabetically and take first one
		usort($files, function($a, $b) {
		    return strcmp($a['filename'], $b['filename']);
		});

		$featuredFile = $files[0];
		$featuredFile['total_count'] = count($files);
		$featured[$category][] = $featuredFile;
	    }
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

                    $roms[] = $romData;
                }
            }
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
