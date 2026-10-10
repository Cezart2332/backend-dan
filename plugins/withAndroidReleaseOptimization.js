const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

module.exports = function withAndroidReleaseOptimization(config) {
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('Android release optimization requires a Groovy app/build.gradle.');
    }

    // Expo's default ProGuard file disables optimization. Use Android's
    // optimized defaults while retaining the native libraries' keep rules.
    config.modResults.contents = config.modResults.contents.replace(
      /getDefaultProguardFile\((["'])proguard-android\.txt\1\)/g,
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );

    if (!/getDefaultProguardFile\((["'])proguard-android-optimize\.txt\1\)/.test(config.modResults.contents)) {
      throw new Error('Could not configure the optimized Android ProGuard defaults.');
    }

    return config;
  });

  return withGradleProperties(config, (config) => {
    // Compiling the native libraries and running R8 in one build exceeds
    // Expo's default 512 MB metaspace limit. Preserve other JVM options.
    const jvmArgs = config.modResults.find(
      (entry) => entry.type === 'property' && entry.key === 'org.gradle.jvmargs'
    );
    const memoryOptions = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

    if (jvmArgs) {
      const otherOptions = jvmArgs.value
        .replace(/(?:^|\s)-Xmx\S+/g, '')
        .replace(/(?:^|\s)-XX:MaxMetaspaceSize=\S+/g, '')
        .trim();
      jvmArgs.value = `${otherOptions} ${memoryOptions}`.trim();
    } else {
      config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: memoryOptions });
    }

    return config;
  });
};
