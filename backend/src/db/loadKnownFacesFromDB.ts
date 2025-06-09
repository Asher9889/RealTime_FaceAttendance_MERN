import { Face } from "../models";

export let knownFaceData: { name: string; embedding: number[] }[] = [];

export default async function loadKnownFacesFromDB() {
 try {
   if (knownFaceData.length === 0) {
     // Fetch only once
     knownFaceData = await Face.find({}, {_id: 0, name: 1, embedding: 1});
     console.log("✅ Loaded known face data:", knownFaceData.length);
   }
   return knownFaceData;
 } catch (error) {
    console.log("failded to load face data", error)
 }
}

