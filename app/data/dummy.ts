import { collection, addDoc, getDocs, Firestore } from "firebase/firestore";


export function addProduct(db: Firestore) {
    addDoc(collection(db, "dummy_product"), {
        product: 'Kojie San',
        price: 100,
        // selling_price: 100,
        quantity: 1
    },);
}



export function getProduct(db: Firestore) {
    getDocs(collection(db, "dummy_product")).then((data) => {
        data.forEach((doc)=> {
            console.log(doc.id, " => ", doc.data());
        })
    });
}