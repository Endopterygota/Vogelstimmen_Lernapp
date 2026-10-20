package de.endopterygota.vogelstimmen;

import static org.junit.Assert.*;
import org.junit.Test;

public class UpdatePolicyTest {
    @Test public void comparesStableVersionNumbers() {
        assertTrue(UpdatePolicy.compareVersions("v0.0.10", "0.0.2") > 0);
        assertEquals(0, UpdatePolicy.compareVersions("0.0.2", "v0.0.2"));
        assertTrue(UpdatePolicy.compareVersions("0.0.1", "0.0.2") < 0);
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsPrereleaseVersion() { UpdatePolicy.compareVersions("0.0.3-beta", "0.0.2"); }
    @Test public void limitsDownloadsToThisRepository() {
        assertTrue(UpdatePolicy.isReleaseAsset("https://github.com/Endopterygota/Vogelstimmen_Lernapp/releases/download/v0.0.3/Vogelstimmen-0.0.3.apk"));
        assertFalse(UpdatePolicy.isReleaseAsset("https://github.com/other/repository/releases/download/v1/update.apk"));
        assertFalse(UpdatePolicy.isReleaseAsset("http://github.com/Endopterygota/Vogelstimmen_Lernapp/releases/download/v1/update.apk"));
        assertFalse(UpdatePolicy.isReleaseAsset("https://github.com.evil.example/Endopterygota/Vogelstimmen_Lernapp/releases/download/v1/update.apk"));
        assertFalse(UpdatePolicy.isReleaseAsset("https://github.com:444/Endopterygota/Vogelstimmen_Lernapp/releases/download/v1/update.apk"));
    }
    @Test public void permitsOnlyHttpsGithubDownloadRedirects() {
        assertTrue(UpdatePolicy.isDownloadHost("https://release-assets.githubusercontent.com/path/file?signature=abc"));
        assertTrue(UpdatePolicy.isDownloadHost("https://objects.githubusercontent.com/path"));
        assertFalse(UpdatePolicy.isDownloadHost("https://release-assets.githubusercontent.com.evil.example/file"));
        assertFalse(UpdatePolicy.isDownloadHost("https://example.org/file.apk"));
        assertFalse(UpdatePolicy.isDownloadHost("http://github.com/file.apk"));
        assertFalse(UpdatePolicy.isDownloadHost("https://user@github.com/file.apk"));
    }
}
