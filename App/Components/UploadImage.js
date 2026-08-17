import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';

import {launchImageLibrary} from 'react-native-image-picker';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';

const UploadImage = (props) => {
  const [img, setImg] = useState(props.image);

  useEffect(()=>{
    console.log("Upload Image -=> " + props.image)
  },[props.image])

  const selectImage = () => {
    let options = {
      title: 'You can choose one image',
      maxWidth: 150,
      maxHeight: 150,
      noData: true,
      mediaType: 'photo',
      // storageOptions: {
      //   skipBackup: true
      // }
    };

    launchImageLibrary(options, async response => {
      if(response.didCancel){
        console.log('User cancelled photo picker');
        alert('You did not select any image');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        const source = response.assets[0].uri;
        console.log(source);
        const uploadImage = async () => {
          const response = await fetch(source);
          const blob = await response.blob();
          var ref = storage().ref().child("Profiles/" + await auth().currentUser.uid);
          console.log("working => " + ref)
          return ref.put(blob);
        };

  const getpictureURL = async() => {
    try {
      await storage().ref("Profiles/" + await auth().currentUser.uid).getDownloadURL().then(async(url) => {
        await firestore().collection('Users').doc(await auth().currentUser.uid)
            .update({ image: url })
            .then(() => {
              setImg(url)
              console.log('Uploaded' + url);
            }).catch((err)=>{
              console.log(err);
            }); 
        }).catch((err)=>{
        console.log("There is no Image Available")
        })
      }
        catch(e){
          console.log("getting downloadURL of image error => ", e)
        };
      }
        await uploadImage();
        await getpictureURL();
      }
    });
  }

  return (
    <View>
      <View style={styles.imageContainer}>
        <Image source={img != "" ? { uri: img } : require('../Images/defaultProfile.png') } style={styles.imageBox} resizeMode='contain' />
      </View>
      <TouchableOpacity
        onPress={selectImage}
        style={{ backgroundColor: "lightblue", borderRadius:5, padding:5, marginBottom:10 }}>
        <Text style={styles.selectButtonTitle}>Select Image</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
   
    selectButtonTitle: {
        fontSize: 18,
        textAlign:"center"
    },
    imageContainer: {
        marginTop: 20,
        marginBottom: 15,
        borderWidth: 3,
        borderColor: '#ff5555',
        borderRadius:100,
        paddingLeft: 0.5,
    },
    imageBox: {
        width: 150,
        height: 150,
        borderRadius:100,
        
    }
})
export default UploadImage;