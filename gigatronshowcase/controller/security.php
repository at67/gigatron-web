<?php
/**
 * Shared security functions for GT1 file access verification
 */

/**
 * Verify current user has access to a GT1 file (owns it or is admin)
 * Admins: trusted to use correct URLs, just verify file exists
 * Users: verify they actually own the file via filesystem check
 *
 * @param string $category
 * @param string $urlAuthor Author from URL parameter
 * @param string $filename
 * @param string|null $folder
 * @param string $root_path
 * @return array Verified file info
 * @throws \phpbb\exception\http_exception
 */
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

/**
 * Validate GT1 file format based on the C++ emulator logic
 * Ensures the file follows proper GT1 segment structure with terminator
 *
 * @param string $filePath Path to the GT1 file to validate
 * @param string &$errorMessage Reference to store error message if validation fails
 * @return bool True if valid, false if invalid
 */
function validateGT1File($filePath, &$errorMessage = null)
{
    if (!file_exists($filePath)) {
        $errorMessage = 'GT1 file not found';
        return false;
    }

    $data = file_get_contents($filePath);
    if ($data === false) {
        $errorMessage = 'Could not read GT1 file';
        return false;
    }

    $size = strlen($data);

    if ($size < 3) {
        $errorMessage = 'GT1 file too small (minimum 3 bytes required)';
        return false;
    }

    // Maximum reasonable file size (prevent memory exhaustion)
    if ($size > 131072) { // 128KB limit
        $errorMessage = 'GT1 file too large (maximum 128KB)';
        return false;
    }

    $pos = 0;
    $segmentCount = 0;
    $foundTerminator = false;

    // Parse segments following the C++ emulator logic
    while ($pos + 2 < $size) {
        // Need at least 3 bytes for header
        $hiAddr = ord($data[$pos]);
        $loAddr = ord($data[$pos + 1]);
        $segSize = ord($data[$pos + 2]);

        // Check for terminator: first byte is 0 AND we're at the last 3 bytes
        if ($hiAddr == 0x00 && $pos + 2 == $size - 1) {
            // This is the terminator segment
            $foundTerminator = true;

            // Validate execution address
            $execHi = ord($data[$pos + 1]);
            $execLo = ord($data[$pos + 2]);
            $execAddr = ($execHi << 8) | $execLo;

            // Execution address should be reasonable (not 0x0000)
            if ($execAddr == 0x0000) {
                $errorMessage = 'Invalid GT1: execution address cannot be 0x0000';
                return false;
            }

            break;
        }

        // This is a regular segment, move past header
        $pos += 3;

        // Segment size of 0 means 256 bytes (as per GT1 spec)
        $actualSize = ($segSize == 0) ? 256 : $segSize;

        // Check if segment extends beyond file
        if ($pos + $actualSize > $size) {
            $errorMessage = 'Invalid GT1: segment at address 0x' .
                           sprintf('%02X%02X', $hiAddr, $loAddr) .
                           ' extends beyond file (need ' . ($pos + $actualSize) .
                           ' bytes, have ' . $size . ')';
            return false;
        }

        // Validate segment address is reasonable
        $segmentAddr = ($hiAddr << 8) | $loAddr;
        if ($segmentAddr + $actualSize > 0x10000) {
            $errorMessage = 'Invalid GT1: segment would exceed 64K address space';
            return false;
        }

        // Move to next segment
        $pos += $actualSize;
        $segmentCount++;

        // Sanity check - prevent infinite loops and excessive segments
        if ($segmentCount > 1000) {
            $errorMessage = 'Invalid GT1: too many segments (maximum 1000)';
            return false;
        }
    }

    if (!$foundTerminator) {
        $errorMessage = 'Invalid GT1: missing terminator segment';
        return false;
    }

    if ($segmentCount == 0) {
        $errorMessage = 'Invalid GT1: no data segments found';
        return false;
    }

    return true;
}
