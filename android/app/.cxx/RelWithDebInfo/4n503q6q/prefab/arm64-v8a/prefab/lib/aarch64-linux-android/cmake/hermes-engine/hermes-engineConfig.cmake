if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "C:/Users/zains/.gradle/caches/9.3.1/transforms/35180b27404f4fa908366c707f1d239b/workspace/transformed/hermes-android-250829098.0.14-release/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/zains/.gradle/caches/9.3.1/transforms/35180b27404f4fa908366c707f1d239b/workspace/transformed/hermes-android-250829098.0.14-release/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

