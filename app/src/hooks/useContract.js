import { useContext, useMemo } from "react";
import { Web3Context } from "../context/Web3Context.jsx";

export const useContract = (abi, address) => {
  const { web3 } = useContext(Web3Context);

  return useMemo(() => {
    if (!web3 || !address) return null;
    return new web3.eth.Contract(abi, address);
  }, [web3, address]);
};
