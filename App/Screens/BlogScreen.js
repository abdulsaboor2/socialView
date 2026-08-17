// App/Screens/BlogScreen.js
import React, {useCallback, useRef, useState} from 'react';
import {View, ActivityIndicator, RefreshControl, StyleSheet, Text} from 'react-native';
import {WebView} from 'react-native-webview';

const BLOG_URL = 'https://webratsolutions.com/privacy-policy-socialcraze/';

const BlogScreen = () => {
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canRefresh, setCanRefresh] = useState(false);
  const [error, setError] = useState(false);

  const onLoadStart = () => {
    setLoading(true);
    setError(false);
  };
  const onLoadEnd = () => setLoading(false);

  const onError = () => {
    setError(true);
    setLoading(false);
  };

  const onScroll = ({nativeEvent}) => {
    // enable pull-to-refresh only at top
    setCanRefresh(nativeEvent.contentOffset?.y <= 0);
  };

  const onRefresh = useCallback(() => {
    setLoading(true);
    setError(false);
    webRef.current?.reload();
  }, []);

  return (
    <View style={{flex: 1}}>
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Couldn’t load the page</Text>
          <Text style={styles.errorText}>Check your connection and pull down to retry.</Text>
        </View>
      ) : null}

      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{uri: BLOG_URL}}
        startInLoadingState
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onScroll={onScroll}
        pullToRefreshEnabled={false} // we provide our own RefreshControl
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
          </View>
        )}
        // iOS only: content inset fix
        contentInsetAdjustmentBehavior="automatic"
        style={{flex: 1}}
        overScrollMode="always"
      />

      {/* Pull-to-refresh overlay */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <RefreshControl refreshing={loading && canRefresh} onRefresh={onRefresh} enabled={canRefresh} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  errorWrap: {position: 'absolute', top: 20, left: 20, right: 20, zIndex: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2},
  errorTitle: {fontWeight: '800', color: '#111', marginBottom: 4},
  errorText: {color: '#444'},
});

export default BlogScreen;
