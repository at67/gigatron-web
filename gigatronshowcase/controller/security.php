<?php
function verifyUserFileAccess($category, $urlAuthor, $filename, $folder, $root_path)
{
    global $phpbb_container;
    $auth = $phpbb_container->get('auth');
    $user = $phpbb_container->get('user');

    // Get trusted username from phpBB
    $trustedUsername = $user->data['username'];

    // Build filepath
    if ($folder !== null) {
        $filepath = $folder . '/' . $filename;
    } else {
        $filepath = $filename;
    }

    // Build the file path using URL author parameter
    $targetFilePath = $root_path . 'ext/at67/gigatronemulator/gt1/' . $category . '/' . $urlAuthor . '/' . $filepath;

    // Check if user is admin
    $isAdmin = $auth->acl_get('a_');

    if ($isAdmin) {
        // Admin: trust URL, just verify file exists
        if (!file_exists($targetFilePath)) {
            throw new \phpbb\exception\http_exception(404, 'GT1 file not found');
        }

        return [
            'file_path' => $targetFilePath,
            'actual_author' => $urlAuthor,
            'trusted_username' => $trustedUsername,
            'is_admin' => true,
            'user_owns_file' => ($urlAuthor === $trustedUsername)
        ];

    } else {
        // Regular user: verify they actually own the file via filesystem
        $userOwnedPath = $root_path . 'ext/at67/gigatronemulator/gt1/' . $category . '/' . $trustedUsername . '/' . $filepath;

        // User can only access files that exist in their own directory
        if (!file_exists($userOwnedPath)) {
            throw new \phpbb\exception\http_exception(403, 'You can only access your own GT1 applications');
        }

        // Verify the URL points to user's own file (prevent URL manipulation)
        if ($userOwnedPath !== $targetFilePath) {
            throw new \phpbb\exception\http_exception(403, 'You can only access your own GT1 applications');
        }

        return [
            'file_path' => $userOwnedPath,
            'actual_author' => $trustedUsername,
            'trusted_username' => $trustedUsername,
            'is_admin' => false,
            'user_owns_file' => true
        ];
    }
}

function parseGT1File($filePath, &$errorMessage = null)
{
    if (!file_exists($filePath)) {
        $errorMessage = 'GT1 file not found';
        return false;
    }

    $fileSize = filesize($filePath);
    if ($fileSize < 3 || $fileSize > 131072) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    $data = file_get_contents($filePath);
    if ($data === false) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    $pos = 0;
    $segmentCount = 0;
    $foundTerminator = false;
    $totalSize = 0;
    $execAddr = 0;

    // Parse segments following the C++ emulator logic
    while ($pos + 2 < $fileSize) {
        $hiAddr = ord($data[$pos]);
        $loAddr = ord($data[$pos + 1]);
        $segSize = ord($data[$pos + 2]);

        // Check for terminator
        if ($hiAddr == 0x00 && $pos + 2 == $fileSize - 1) {
            $foundTerminator = true;
            $execHi = ord($data[$pos + 1]);
            $execLo = ord($data[$pos + 2]);
            $execAddr = ($execHi << 8) | $execLo;
            break;
        }

        $pos += 3;
        $actualSize = ($segSize == 0) ? 256 : $segSize;

        if ($pos + $actualSize > $fileSize) {
            $errorMessage = 'Invalid GT1 file format';
            return false;
        }

        $segmentAddr = ($hiAddr << 8) | $loAddr;
        if ($segmentAddr + $actualSize > 0x10000) {
            $errorMessage = 'Invalid GT1 file format';
            return false;
        }

        $totalSize += $actualSize;
        $pos += $actualSize;
        $segmentCount++;

        if ($segmentCount > 1000) {
            $errorMessage = 'Invalid GT1 file format';
            return false;
        }
    }

    if (!$foundTerminator || $segmentCount == 0 || $execAddr == 0x0000) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    return [
        'valid' => true,
        'gt1_size' => $totalSize,
        'exec_addr' => $execAddr,
        'segment_count' => $segmentCount
    ];
}

function validateGT1File($filePath, &$errorMessage = null)
{
    $result = parseGT1File($filePath, $errorMessage);
    return $result !== false && $result['valid'];
}

function calculateGT1Size($filePath, &$errorMessage = null)
{
    $result = parseGT1File($filePath, $errorMessage);
    return $result !== false ? $result['gt1_size'] : 0;
}

function logUserAction($action, $category, $folder, $inName, $outName, $fileSize, $authorName, $userName)
{
    $logFile = __DIR__ . '/users.log';
    $logEntry = date('Y-m-d H:i:s') . " $action $category $folder $inName $outName $fileSize $authorName $userName\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}
