<?php
namespace at67\gigatronshowcase\controller;

class featured
{
    protected $root_path;
    protected $content;

    public function __construct($root_path, $content)
    {
        $this->root_path = $root_path;
        $this->content = $content;
    }

    public function getFeaturedGT1s($gt1s)
    {
        $featured = array();

        // Group by category and author
        $grouped = array();
        foreach ($gt1s as $gt1) {
            $category = $gt1['category'];
            $author = $gt1['author'];
            $grouped[$category][$author][] = $gt1;
        }

        // Get category order from content service
        $categoryOrder = $this->content->getCategoryOrder();

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

                        // Add screenshot info using content service
                        $featuredFile = $this->content->addScreenshotInfo($featuredFile);

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

                // Add screenshot info using content service
                $featuredFile = $this->content->addScreenshotInfo($featuredFile);

                $featured[$categoryName][] = $featuredFile;
            }

            // Shuffle the authors within this category
            shuffle($featured[$categoryName]);
        }

        return $featured;
    }

    public function getFeaturedGT1()
    {
        // Get today's featured author
        $featuredAuthor = $this->getFeaturedAuthors();

        // Get all GT1s for this author
        $allGt1s = $this->content->scanGT1s();
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
            $metadata = $this->content->parseIniMetadata($iniFile);
            $selectedGt1 = array_merge($selectedGt1, $metadata);
        }

        // Add screenshot info
        $selectedGt1 = $this->content->addScreenshotInfo($selectedGt1);

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

    public function getFeaturedAuthors()
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
}
