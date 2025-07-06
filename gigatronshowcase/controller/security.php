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

function validateGT1File($filePath, &$errorMessage = null)
{
    if (!file_exists($filePath)) {
        $errorMessage = 'GT1 file not found';
        return false;
    }

    // Check file size
    $fileSize = filesize($filePath);
    if ($fileSize < 3  ||  $fileSize > 131072) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    // Load into memory
    $data = file_get_contents($filePath);
    if ($data === false) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    $pos = 0;
    $segmentCount = 0;
    $foundTerminator = false;

    // Parse segments following the C++ emulator logic
    while ($pos + 2 < $fileSize) {
        // Need at least 3 bytes for header
        $hiAddr = ord($data[$pos]);
        $loAddr = ord($data[$pos + 1]);
        $segSize = ord($data[$pos + 2]);

        // Check for terminator: first byte is 0 AND we're at the last 3 bytes
        if ($hiAddr == 0x00 && $pos + 2 == $fileSize - 1) {
            // This is the terminator segment
            $foundTerminator = true;

            // Validate execution address
            $execHi = ord($data[$pos + 1]);
            $execLo = ord($data[$pos + 2]);
            $execAddr = ($execHi << 8) | $execLo;

            // Execution address should be reasonable (not 0x0000)
            if ($execAddr == 0x0000) {
                $errorMessage = 'Invalid GT1 file format';
                return false;
            }

            break;
        }

        // This is a regular segment, move past header
        $pos += 3;

        // Segment size of 0 means 256 bytes (as per GT1 spec)
        $actualSize = ($segSize == 0) ? 256 : $segSize;

        // Check if segment extends beyond file
        if ($pos + $actualSize > $fileSize) {
            $errorMessage = 'Invalid GT1 file format';
            return false;
        }

        // Validate segment address is reasonable
        $segmentAddr = ($hiAddr << 8) | $loAddr;
        if ($segmentAddr + $actualSize > 0x10000) {
            $errorMessage = 'Invalid GT1 file format';
            return false;
        }

        // Move to next segment
        $pos += $actualSize;
        $segmentCount++;

        // Sanity check - prevent infinite loops and excessive segments
        if ($segmentCount > 1000) {
            $errorMessage = 'Invalid GT1 file format';
            return false;
        }
    }

    if (!$foundTerminator) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    if ($segmentCount == 0) {
        $errorMessage = 'Invalid GT1 file format';
        return false;
    }

    return true;
}

function logUserAction($action, $category, $folder, $inName, $outName, $fileSize, $authorName, $userName)
{
    $logFile = __DIR__ . '/users.log';
    $logEntry = date('Y-m-d H:i:s') . " $action $category $folder $inName $outName $fileSize $authorName $userName\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}
