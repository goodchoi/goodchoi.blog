import React from "react"
import styled from "styled-components"
import CheckMark from "./Instagram-Verification Badge-64.png"

import {
  FaGithub,
  FaKaggle,
  FaFacebook,
  FaTwitter,
  FaLinkedin,
  FaInstagram,
} from "react-icons/fa"

import {
  FaXTwitter,
  FaRegEnvelope,
  FaMedium,
  FaBlogger,
  FaRegFileLines,
  FaLink,
} from "react-icons/fa6"

import { siteUrl, description, author, links } from "../../../blog-config"

const BioWrapper = styled.div`
  display: flex;
  align-items: center;
  

  @media (max-width: 768px) {
    padding: 0 15px;
  }
`

const profileImageRoot =
  typeof window !== "undefined" && window.location.host === "localhost:8000"
    ? "http://localhost:8000"
    : siteUrl

const ProfileWrapper = styled.div`
  width: 128px;
  height: 128px;
  border-radius: 100%;
  border: 3px solid transparent;
  background-image: linear-gradient(${props => props.theme.colors.bodyBackground}, ${props => props.theme.colors.bodyBackground}), 
  linear-gradient(45deg, #ffc400 20%,  #ff0069 55%, #c00fdc 85%);
  background-origin: border-box;
  background-clip: content-box, border-box;
  position: absolute;
`
const Profile = styled.div`
  width: 118px;
  height: 118px;
  border-radius: 100%;
  background-image: url(${profileImageRoot}/profile.png);
  background-size: cover;
  background-position: center;
  position: absolute;
 `
const ProfileFrame = styled.div`
  flex: 0 0 auto;
  margin-right: 16px;
  width: 135px;
  height: 135px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`

const TestWrapper = styled.div`
  display: flex;
  align-items: center;
`
const Author = styled.div`
  margin-bottom: 4.8px;
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
`

const InstagramMark = styled.img`
  width: 27.1px;
  margin-left: 4.8px;
  padding-bottom: 6.3px;
`

const Description = styled.div`
  margin-bottom: 11.2px;
  line-height: 1.5;
  font-size: 16px;
  color: ${props => props.theme.colors.secondaryText};
`

const LinksWrapper = styled.div`
  & a {
    margin-right: 9.6px;
  }

  & svg {
    width: 25.6px;
    height: 25.6px;
    cursor: pointer;
  }

  & svg path {
    fill: ${props => props.theme.colors.icon};
    transition: fill 0.3s;
  }

  & a:hover svg path {
    fill: ${props => props.theme.colors.text};
  }
`

const Link = ({ link, children }) => {
  if (!link) return null
  return (
    <a href={link} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

const Bio = () => {
  const {
    github,
    kaggle,
    instagram,
    facebook,
    twitter,
    x,
    blogger,
    medium,
    linkedIn,
    email,
    resume,
    link,
  } = links

  return (
    <BioWrapper id="bio">
      <ProfileFrame><ProfileWrapper/><Profile /></ProfileFrame>
      <div>
        <TestWrapper>
          <Author>@{author}</Author>
          <InstagramMark src={CheckMark} alt="CheckMark" />
        </TestWrapper>
        <Description>{description}</Description>
        <LinksWrapper>
          <Link link={github}>
            <FaGithub />
          </Link>
          <Link link={kaggle}>
            <FaKaggle />
          </Link>
          <Link link={instagram}>
            <FaInstagram />
          </Link>
          <Link link={facebook}>
            <FaFacebook />
          </Link>
          <Link link={twitter}>
            <FaTwitter />
          </Link>
          <Link link={x}>
            <FaXTwitter />
          </Link>
          <Link link={medium}>
            <FaMedium />
          </Link>
          <Link link={blogger}>
            <FaBlogger />
          </Link>
          <Link link={linkedIn}>
            <FaLinkedin />
          </Link>
          <Link link={email}>
            <FaRegEnvelope />
          </Link>
          <Link link={resume}>
            <FaRegFileLines />
          </Link>
          <Link link={link}>
            <FaLink />
          </Link>
        </LinksWrapper>
      </div>
    </BioWrapper>
  )
}

export default Bio
